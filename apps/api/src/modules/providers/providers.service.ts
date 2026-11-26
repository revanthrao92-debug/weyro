import { assertOwnedMediaKeys } from '../../common/media/media-key';
import { resolveRequestVehicle } from '../../common/serializers/request-vehicle';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PROVIDER_TYPE_CATEGORIES } from '@weyro/api-contracts';
import { addDays, buildDailyBuckets, summariseAnalytics } from './analytics';
import { istDayStart } from '../../common/utils/ist-day';
import { forecastEarnings } from './forecast';

/** Days are counted in Indian time, so a 1 am sale and "today" match the dealer's calendar. */
const IST_OFFSET_MINUTES = 330;
/** The forecast learns from up to six months of sales, whatever range the screen shows. */
const MODEL_DAYS = 183;
import { CacheService } from '../../common/redis/cache.service';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';
import { toPublicProvider } from '../../common/serializers/public-provider';
import {
  SubmitVerificationDocumentsDto,
  UpdateProviderProfileDto,
} from './dto/providers.dto';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private providerId(user: AuthUserPayload): string {
    if (!user.providerProfileId) {
      throw new ForbiddenException('Provider profile required');
    }
    return user.providerProfileId;
  }

  async getMyProfile(user: AuthUserPayload) {
    const id = this.providerId(user);
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, phone: true, isActive: true } },
        _count: {
          select: {
            quotations: true,
            bookings: true,
            reviews: true,
            spareParts: true,
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const { user: account, _count, ...profile } = provider;
    return {
      ...profile,
      email: account.email,
      accountPhone: account.phone,
      isActive: account.isActive,
      counts: {
        quotations: _count.quotations,
        bookings: _count.bookings,
        reviews: _count.reviews,
        listings: _count.spareParts,
      },
    };
  }

  async getAnalytics(user: AuthUserPayload, days = 30) {
    const id = this.providerId(user);
    const periodDays = Math.min(90, Math.max(7, Math.round(days)));
    const now = new Date();
    const modelStart = addDays(now, -(MODEL_DAYS + 1));
    const todayStart = istDayStart(now);
    const periodStart = addDays(todayStart, -(periodDays - 1)); // first day shown on the chart
    const last28 = addDays(now, -28);

    const profile = await this.prisma.providerProfile.findUnique({
      where: { id },
      select: { providerType: true, isAvailable: true },
    });
    const categories =
      PROVIDER_TYPE_CATEGORIES[profile?.providerType as keyof typeof PROVIDER_TYPE_CATEGORIES] ?? [];
    const requestCount = (from: Date, to: Date) =>
      categories.length
        ? this.prisma.serviceRequest.count({
            where: { category: { in: categories as any }, deletedAt: null, createdAt: { gte: from, lt: to } },
          })
        : Promise.resolve(0);

    const [
      orders,
      pendingAggregate,
      listings,
      quotesSent,
      quotesAccepted,
      pendingQuotes,
      decidedQuotes,
      allAccepted,
      unitsByPart,
      requestsLast7,
      requestsPrevious56,
    ] = await Promise.all([
      this.prisma.sparePartOrder.findMany({
        where: { providerId: id, deletedAt: null, paidAt: { gte: modelStart } },
        select: { totalAmount: true, paidAt: true, refundedAt: true, status: true },
        // shortcut: loads each order row; past ~20k orders in six months, group by day in SQL instead.
        take: 20000,
      }),
      this.prisma.sparePartOrder.aggregate({
        where: { providerId: id, status: 'PENDING', deletedAt: null },
        _sum: { totalAmount: true },
      }),
      this.prisma.sparePart.findMany({
        where: { providerId: id, deletedAt: null },
        select: { id: true, name: true, price: true, stockQuantity: true, isActive: true },
      }),
      this.prisma.quotation.count({
        where: { providerId: id, deletedAt: null, createdAt: { gte: periodStart } },
      }),
      this.prisma.quotation.count({
        where: { providerId: id, deletedAt: null, status: 'ACCEPTED', createdAt: { gte: periodStart } },
      }),
      this.prisma.quotation.aggregate({
        where: { providerId: id, deletedAt: null, status: 'PENDING' },
        _sum: { totalCost: true },
        _count: true,
      }),
      this.prisma.quotation.count({
        where: { providerId: id, deletedAt: null, status: { in: ['ACCEPTED', 'REJECTED', 'EXPIRED'] } },
      }),
      this.prisma.quotation.count({
        where: { providerId: id, deletedAt: null, status: 'ACCEPTED' },
      }),
      this.prisma.sparePartOrder.groupBy({
        by: ['sparePartId'],
        where: { providerId: id, deletedAt: null, status: 'PAID', paidAt: { gte: last28 } },
        _sum: { quantity: true },
      }),
      requestCount(addDays(now, -7), now),
      requestCount(addDays(now, -63), addDays(now, -7)),
    ]);

    const analyticsOrders = orders.map((order) => ({
      ...order,
      totalAmount: Number(order.totalAmount),
    }));
    const allDays = buildDailyBuckets(analyticsOrders, MODEL_DAYS + 1, now, IST_OFFSET_MINUTES);
    const buckets = allDays.slice(-periodDays);
    const periodOrders = analyticsOrders.filter(
      (order) => order.paidAt && order.paidAt.getTime() >= periodStart.getTime(),
    );
    const summary = summariseAnalytics(buckets, periodOrders);
    const activeListings = listings.filter((item) => item.isActive);
    const unitsSold = new Map(unitsByPart.map((row) => [row.sparePartId, row._sum.quantity ?? 0]));

    const forecast = forecastEarnings({
      history: allDays.slice(0, -1), // today isn't over yet
      shopOpen: profile?.isAvailable ?? true,
      parts: activeListings.map((item) => ({
        name: item.name,
        price: Number(item.price),
        stock: item.stockQuantity,
        unitsLast28: unitsSold.get(item.id) ?? 0,
      })),
      quotes: {
        pendingTotal: Number(pendingQuotes._sum.totalCost ?? 0),
        pendingCount: pendingQuotes._count,
        accepted: allAccepted,
        decided: decidedQuotes,
      },
      demand: { last7: requestsLast7, previous56: requestsPrevious56 },
    });

    return {
      periodDays,
      currency: 'INR',
      summary: {
        ...summary,
        pendingValue: Number(pendingAggregate._sum.totalAmount ?? 0),
        inventoryValue:
          Math.round(
            activeListings.reduce((sum, item) => sum + Number(item.price) * item.stockQuantity, 0) * 100,
          ) / 100,
        activeListings: activeListings.length,
        lowStockListings: activeListings.filter((item) => item.stockQuantity <= 3).length,
        quotesSent,
        quotesAccepted,
        quoteConversionRate:
          quotesSent === 0 ? 0 : Math.round((quotesAccepted / quotesSent) * 1000) / 10,
      },
      buckets,
      forecast,
    };
  }

  async getDashboard(user: AuthUserPayload) {
    const id = this.providerId(user);
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        businessName: true,
        providerType: true,
        verificationStatus: true,
        isAvailable: true,
        avgRating: true,
        totalReviews: true,
        completedJobs: true,
        serviceRadiusKm: true,
      },
    });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const categories =
      PROVIDER_TYPE_CATEGORIES[
        provider.providerType as keyof typeof PROVIDER_TYPE_CATEGORIES
      ] ?? [];

    // Indian day: the server runs in UTC (midnight there is 05:30 IST).
    const dayStart = istDayStart();
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

    const [
      openRequests,
      pendingQuotes,
      pendingOrders,
      listings,
      recentOrders,
      recentQuotes,
      paidAggregate,
      todayPaidAggregate,
      activeJobs,
      completedJobs,
      todayJobs,
      recentBookings,
    ] = await Promise.all([
      categories.length
        ? this.prisma.serviceRequest.count({
            where: {
              category: { in: categories as any },
              status: { in: ['OPEN', 'QUOTES_RECEIVED'] },
              deletedAt: null,
            },
          })
        : Promise.resolve(0),
      this.prisma.quotation.count({
        where: { providerId: id, status: 'PENDING', deletedAt: null },
      }),
      this.prisma.sparePartOrder.count({
        where: {
          providerId: id,
          status: 'PAID',
          fulfillmentStatus: { notIn: ['DELIVERED', 'CANCELLED'] },
          deletedAt: null,
        },
      }),
      this.prisma.sparePart.findMany({
        where: { providerId: id, deletedAt: null },
        select: { price: true, stockQuantity: true, isActive: true },
      }),
      this.prisma.sparePartOrder.findMany({
        where: { providerId: id, status: 'PAID', deletedAt: null },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        take: 4,
        select: {
          id: true,
          totalAmount: true,
          status: true,
          fulfillmentStatus: true,
          createdAt: true,
          sparePart: { select: { name: true, partNumber: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.quotation.findMany({
        where: { providerId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: {
          id: true,
          totalCost: true,
          status: true,
          createdAt: true,
          request: { select: { id: true, title: true, category: true } },
        },
      }),
      this.prisma.sparePartOrder.aggregate({
        where: { providerId: id, status: 'PAID', deletedAt: null },
        _sum: { totalAmount: true },
      }),
      this.prisma.sparePartOrder.aggregate({
        where: {
          providerId: id,
          status: 'PAID',
          deletedAt: null,
          paidAt: { gte: dayStart },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.booking.count({
        where: {
          providerId: id,
          deletedAt: null,
          status: { in: ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.booking.count({
        where: { providerId: id, deletedAt: null, status: 'COMPLETED' },
      }),
      this.prisma.booking.count({
        where: {
          providerId: id,
          deletedAt: null,
          status: { in: ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'] },
          scheduledAt: { gte: dayStart, lt: dayEnd },
        },
      }),
      this.prisma.booking.findMany({
        where: { providerId: id, deletedAt: null },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
        take: 4,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          quotation: {
            include: {
              request: {
                include: { vehicle: { select: { make: true, model: true, year: true } } },
              },
            },
          },
        },
      }),
    ]);

    const activeListings = listings.filter((item) => item.isActive).length;
    const lowStock = listings.filter(
      (item) => item.isActive && item.stockQuantity <= 3,
    ).length;
    const inventoryValue = listings
      .filter((item) => item.isActive)
      .reduce(
        (sum, item) => sum + Number(item.price) * item.stockQuantity,
        0,
      );

    return {
      provider,
      counts: {
        openRequests,
        pendingQuotes,
        pendingOrders,
        activeListings,
        lowStock,
      },
      revenue: {
        paidTotal: Number(paidAggregate._sum.totalAmount ?? 0),
        todayPaid: Number(todayPaidAggregate._sum.totalAmount ?? 0),
        inventoryValue: Math.round(inventoryValue * 100) / 100,
      },
      recentOrders: recentOrders.map((order) => ({
        ...order,
        totalAmount: Number(order.totalAmount),
      })),
      recentQuotes: recentQuotes.map((quote) => ({
        ...quote,
        totalCost: Number(quote.totalCost),
      })),
      jobs: {
        active: activeJobs,
        completed: completedJobs,
        today: todayJobs,
        recent: recentBookings.map((booking) => ({
          id: booking.id,
          status: booking.status,
          scheduledAt: booking.scheduledAt,
          createdAt: booking.createdAt,
          completedAt: booking.completedAt,
          customer: booking.customer,
          request: booking.quotation?.request
            ? {
                id: booking.quotation.request.id,
                title: booking.quotation.request.title,
                category: booking.quotation.request.category,
                address: booking.quotation.request.address,
                // C4: saved vehicle or the request's free-form make/model/year.
                vehicle: (() => {
                  const v = resolveRequestVehicle(booking.quotation.request);
                  return v ? { make: v.make, model: v.model, year: v.year } : null;
                })(),
              }
            : null,
          totalCost: Number(booking.quotation?.totalCost ?? 0),
        })),
      },
    };
  }

  async updateMyProfile(
    user: AuthUserPayload,
    dto: UpdateProviderProfileDto,
  ) {
    const id = this.providerId(user);
    const updated = await this.prisma.providerProfile.update({
      where: { id },
      data: dto,
    });
    await this.cache.del(`provider:public:${id}`);
    return updated;
  }

  /**
   * Provider submits private KYC document keys. Submitting documents only puts
   * the account back in the review queue; it never marks the provider verified.
   */
  async submitVerificationDocuments(
    user: AuthUserPayload,
    dto: SubmitVerificationDocumentsDto,
  ) {
    const id = this.providerId(user);
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id },
      select: { verificationStatus: true },
    });

    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }
    if (provider.verificationStatus === 'SUSPENDED') {
      throw new ForbiddenException(
        'Suspended providers cannot submit new verification documents',
      );
    }

    const ownPrefix = `verification-documents/${user.sub}/`;
    const documents: Record<string, string> = {};
    for (const document of dto.documents) {
      if (!document.key.startsWith(ownPrefix) || document.key.includes('..')) {
        throw new BadRequestException(
          'Document keys must be uploads owned by your account',
        );
      }
      documents[document.label] = document.key;
    }
    // H4: documents must also be finalized uploads (object exists, passed validation).
    await assertOwnedMediaKeys(
      this.prisma,
      user.sub,
      Object.values(documents),
      ['verification-documents'],
    );

    const updated = await this.prisma.providerProfile.update({
      where: { id },
      data: {
        verificationDocuments: documents,
        verificationStatus: 'PENDING',
        verifiedAt: null,
        verifiedBy: null,
        auditorNotes: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        actorRole: user.role,
        action: 'provider.documents.submit',
        entityType: 'ProviderProfile',
        entityId: id,
        oldValues: { status: provider.verificationStatus },
        newValues: {
          status: updated.verificationStatus,
          documentCount: dto.documents.length,
        },
      },
    });

    await this.cache.del(`provider:public:${id}`);
    return {
      verificationStatus: updated.verificationStatus,
      documentCount: dto.documents.length,
    };
  }

  /**
   * Public provider page. Deliberately excludes phone, exact address and KYC
   * documents: customers only get the marketing-safe projection.
   */
  async getPublicProfile(id: string) {
    return this.cache.getOrSet(
      `provider:public:${id}`,
      300, // 5 min TTL
      async () => {
        return this._loadPublicProfile(id);
      },
    );
  }

  private async _loadPublicProfile(id: string) {
    const provider = await this.prisma.providerProfile.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        businessName: true,
        providerType: true,
        description: true,
        serviceRadiusKm: true,
        verificationStatus: true,
        avgRating: true,
        totalReviews: true,
        completedJobs: true,
        isAvailable: true,
        towingVehicleTypes: true,
        maxVehicleWeightKg: true,
        towingBaseFee: true,
        towingPerKmFee: true,
      },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const base = toPublicProvider(provider);
    return {
      ...base,
      towingVehicleTypes: provider.towingVehicleTypes,
      maxVehicleWeightKg: provider.maxVehicleWeightKg ?? null,
      towingBaseFee: provider.towingBaseFee
        ? Number(provider.towingBaseFee)
        : null,
      towingPerKmFee: provider.towingPerKmFee
        ? Number(provider.towingPerKmFee)
        : null,
    };
  }

  async getPublicReviews(id: string, cursor?: string, limit: number = 20) {
    const boundedLimit = Math.min(50, Math.max(1, limit));
    const cursorTuple = cursor ? decodeCursor(cursor) : null;

    const provider = await this.prisma.providerProfile.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const reviews = await this.prisma.review.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        providerId: id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    return {
      items: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        customerName: `${review.customer.firstName} ${
          review.customer.lastName
            ? `${review.customer.lastName.charAt(0)}.`
            : ''
        }`.trim(),
      })),
      nextCursor:
        reviews.length === boundedLimit
          ? encodeCursor({
              createdAt: reviews[reviews.length - 1].createdAt.toISOString(),
              id: reviews[reviews.length - 1].id,
            })
          : null,
    };
  }
}
