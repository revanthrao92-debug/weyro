import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PROVIDER_TYPE_CATEGORIES } from '@weyro/api-contracts';
import { CacheService } from '../../common/redis/cache.service';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';
import { toPublicProvider } from '../../common/serializers/public-provider';
import { UpdateProviderProfileDto } from './dto/providers.dto';

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

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [
      openRequests,
      pendingQuotes,
      pendingOrders,
      listings,
      recentOrders,
      recentQuotes,
      paidAggregate,
      todayPaidAggregate,
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
        where: { providerId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
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
