import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { validatePaymentTransition } from '../../common/state-machines/state-machines';
import { VerifyProviderDto } from './dto/verify-provider.dto';
import {
  AdminOverviewMetrics,
  EscrowLedgerEntry,
  ProviderVerificationRecord,
} from '@weyro/api-contracts';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../payments/interfaces/payment-gateway.interface';
import {
  STORAGE_SERVICE,
  StorageService,
} from '../uploads/interfaces/storage.interface';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Optional()
    @Inject(STORAGE_SERVICE)
    private readonly storage?: StorageService,
  ) {}

  async getOverview(): Promise<AdminOverviewMetrics> {
    const [
      totalRequests,
      openBroadcasts,
      totalQuotations,
      acceptedQuotations,
      totalBookings,
      completedBookings,
      pendingVerifications,
      verifiedProviders,
      payments,
    ] = await Promise.all([
      this.prisma.serviceRequest.count(),
      this.prisma.serviceRequest.count({ where: { status: 'OPEN', isBroadcast: true } }),
      this.prisma.quotation.count(),
      this.prisma.quotation.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.providerProfile.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.providerProfile.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.payment.findMany({
        where: { status: { in: ['AUTHORIZED', 'CAPTURED'] } },
        select: { amount: true },
      }),
    ]);

    const totalEscrowVolume = payments.reduce((acc, p) => acc + Number(p.amount), 0);

    return {
      totalRequests,
      openBroadcasts,
      totalQuotations,
      acceptedQuotations,
      totalBookings,
      completedBookings,
      totalEscrowVolume,
      pendingVerifications,
      verifiedProviders,
    };
  }

  async getOrders(params: { status?: string; fulfillmentStatus?: string }) {
    const items = await this.prisma.sparePartOrder.findMany({
      where: {
        deletedAt: null,
        ...(params.status ? { status: params.status as any } : {}),
        ...(params.fulfillmentStatus
          ? { fulfillmentStatus: params.fulfillmentStatus as any }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        fulfillmentStatus: true,
        quantity: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        refundedAt: true,
        carrierName: true,
        trackingNumber: true,
        sparePart: { select: { name: true, partNumber: true } },
        provider: { select: { businessName: true, providerType: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    return {
      items: items.map((item) => ({
        ...item,
        totalAmount: Number(item.totalAmount),
      })),
    };
  }

  async getBookings(params: { status?: string; category?: string }) {
    const items = await this.prisma.booking.findMany({
      where: {
        deletedAt: null,
        ...(params.status ? { status: params.status as any } : {}),
        ...(params.category
          ? { quotation: { request: { category: params.category as any } } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        provider: { select: { businessName: true, providerType: true } },
        quotation: {
          include: {
            request: {
              select: {
                id: true,
                title: true,
                category: true,
                address: true,
              },
            },
          },
        },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    return {
      items: items.map((booking) => ({
        id: booking.id,
        status: booking.status,
        scheduledAt: booking.scheduledAt,
        createdAt: booking.createdAt,
        completedAt: booking.completedAt,
        completionNotes: booking.completionNotes,
        customer: booking.customer,
        provider: booking.provider,
        request: booking.quotation?.request ?? null,
        totalCost: Number(booking.quotation?.totalCost ?? 0),
        payment: booking.payments[0]
          ? {
              id: booking.payments[0].id,
              status: booking.payments[0].status,
              amount: Number(booking.payments[0].amount),
            }
          : null,
      })),
    };
  }

  async refundBooking(bookingId: string, adminUserId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!booking || booking.deletedAt) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const payment = booking.payments[0];
    if (!payment) {
      throw new ConflictException('Booking has no payment to refund');
    }
    if (payment.status === 'REFUNDED') {
      return {
        bookingId,
        paymentId: payment.id,
        status: 'REFUNDED',
        refundId: null,
      };
    }
    if (!payment.gatewayPaymentId) {
      throw new ConflictException('Payment has no gateway reference to refund');
    }

    validatePaymentTransition(payment.status, 'REFUNDED', 'ADMIN');

    // Claim the payment before touching the gateway so concurrent or retried
    // admin requests cannot both initiate a refund.
    const claimed = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: payment.status },
      data: { status: 'REFUNDED' },
    });
    if (claimed.count === 0) {
      throw new ConflictException('Payment is no longer refundable');
    }

    const amountInPaise = Math.round(Number(payment.amount) * 100);
    let refund;
    try {
      // A timeout after gateway success can leave local state CAPTURED.
      // Reuse the existing gateway refund instead of issuing a second one.
      refund =
        (await this.gateway.findRefund?.(
          payment.gatewayPaymentId,
          amountInPaise,
        )) ??
        (await this.gateway.refundPayment({
          paymentId: payment.gatewayPaymentId,
          amountInPaise,
          notes: { bookingId, reason: 'admin_refund' },
        }));
    } catch (error) {
      // Only a failed gateway call may release the claim. Reverting after a
      // successful refund would allow a second refund or a provider payout.
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'REFUNDED' },
        data: { status: payment.status as any },
      });
      throw error;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminUserId ?? null,
          actorRole: 'ADMIN',
          action: 'payment.refund',
          entityType: 'Payment',
          entityId: payment.id,
          oldValues: { status: payment.status },
          newValues: {
            status: 'REFUNDED',
            refundId: refund.refundId,
            bookingId,
          },
        },
      });
    } catch (error) {
      // The money is already refunded; never undo the state for an audit write.
      this.logger.error(
        `Refund ${refund.refundId} succeeded but audit logging failed: ${(error as Error).message}`,
      );
    }

    return {
      bookingId,
      paymentId: payment.id,
      status: 'REFUNDED',
      refundId: refund.refundId,
    };
  }

  async getProviders(status?: string): Promise<ProviderVerificationRecord[]> {
    const providers = await this.prisma.providerProfile.findMany({
      where: status ? { verificationStatus: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return providers.map((p) => ({
      id: p.id,
      businessName: p.businessName,
      providerType: p.providerType as any,
      phone: p.phone,
      address: p.address,
      verificationStatus: p.verificationStatus as any,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async verifyProvider(
    id: string,
    dto: VerifyProviderDto,
    adminUserId?: string,
  ): Promise<ProviderVerificationRecord> {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    const updated = await this.prisma.providerProfile.update({
      where: { id },
      data: {
        verificationStatus: dto.status as any,
        verifiedBy: adminUserId,
        verifiedAt: dto.status === 'VERIFIED' ? new Date() : null,
        auditorNotes: dto.auditorNotes,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminUserId ?? null,
        actorRole: 'ADMIN',
        action: 'provider.verify',
        entityType: 'ProviderProfile',
        entityId: id,
        oldValues: { status: provider.verificationStatus },
        newValues: {
          status: updated.verificationStatus,
          auditorNotes: dto.auditorNotes ?? null,
        },
      },
    });

    return {
      id: updated.id,
      businessName: updated.businessName,
      providerType: updated.providerType as any,
      phone: updated.phone,
      address: updated.address,
      verificationStatus: updated.verificationStatus as any,
      auditorNotes: dto.auditorNotes,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async getEscrowLedger(): Promise<EscrowLedgerEntry[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: { in: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'REFUNDED', 'RELEASED'] },
      },
      include: {
        booking: {
          include: {
            customer: true,
            provider: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((payment) => ({
      bookingId: payment.bookingId,
      paymentId: payment.id,
      customerName: `${payment.booking?.customer?.firstName || 'Customer'} ${
        payment.booking?.customer?.lastName || ''
      }`.trim(),
      providerName:
        payment.booking?.provider?.businessName || 'Verified Provider',
      amount: Number(payment.amount),
      status:
        payment.status === 'REFUNDED'
          ? 'REFUNDED_TO_CUSTOMER'
          : payment.status === 'RELEASED'
            ? 'RELEASED_TO_PROVIDER'
            : 'HELD_IN_ESCROW',
      bookingStatus: payment.booking?.status,
      payoutReference: payment.payoutReference ?? undefined,
      releasedAt:
        payment.status === 'REFUNDED'
          ? undefined
          : payment.paidToProviderAt?.toISOString() ??
            (payment.status === 'RELEASED'
              ? (payment.booking?.completedAt ?? payment.updatedAt).toISOString()
              : undefined),
      confirmedAt: (payment.paidAt ?? payment.createdAt).toISOString(),
      completedAt: payment.booking?.completedAt
        ? payment.booking.completedAt.toISOString()
        : undefined,
    }));
  }

  async getProviderDetail(id: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, phone: true, isActive: true } },
        _count: {
          select: { quotations: true, bookings: true, reviews: true, spareParts: true },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    const { user, _count, ...profile } = provider;

    return {
      ...profile,
      email: user.email,
      verificationDocuments: await this.resolveDocuments(
        provider.verificationDocuments,
      ),
      counts: {
        quotations: _count.quotations,
        bookings: _count.bookings,
        reviews: _count.reviews,
        listings: _count.spareParts,
      },
    };
  }

  /** Private buckets store keys; admins need a short-lived signed URL. */
  private async resolveDocuments(value: unknown): Promise<Record<string, string> | null> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    const resolved = await Promise.all(
      entries.map(async ([label, key]) => {
        if (/^https?:\/\//i.test(key) || !this.storage) return [label, key] as const;
        try {
          const { downloadUrl } = await this.storage.getPresignedDownloadUrl({
            key,
            expiresInSeconds: 300,
          });
          return [label, downloadUrl] as const;
        } catch {
          return [label, key] as const;
        }
      }),
    );
    return Object.fromEntries(resolved);
  }

  async getActivityLogs(params: { action?: string; cursor?: string; limit?: number }) {
    const boundedLimit = Math.min(100, Math.max(1, params.limit || 20));
    const cursorTuple = params.cursor ? decodeCursor(params.cursor) : null;
    const where: any = {
      ...buildCursorWhere(cursorTuple),
    };

    if (params.action) {
      where.action = params.action;
    }

    const items = await this.prisma.auditLog.findMany({
      where,
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        actorId: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        oldValues: true,
        newValues: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });

    return {
      items: items.map((log) => ({
        ...log,
        newValues: log.newValues ?? undefined,
        oldValues: log.oldValues ?? undefined,
        createdAt: log.createdAt.toISOString(),
      })),
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  /**
   * Traffic snapshot: per-day volumes of the last 7 days for each service
   * surface, plus selected totals. Server-aggregated so the console does not
   * need to slice large client-side lists.
   */
  async getActivityStats() {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 6);
    since.setUTCHours(0, 0, 0, 0);

    const dayOf = (date: Date) => {
      const key = date.toISOString().slice(0, 10);
      return key;
    };

    const aggregate = async (
      model: 'serviceRequest' | 'booking' | 'quotation' | 'sparePartOrder',
    ) => {
      const rows = await (this.prisma as any)[model].findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      });
      const counts: Record<string, number> = {};
      for (const row of rows) {
        const key = dayOf(row.createdAt);
        counts[key] = (counts[key] || 0) + 1;
      }
      return counts;
    };

    const [
      requests,
      bookings,
      quotations,
      sparePartOrders,
      totalUsers,
      totalProviders,
    ] = await Promise.all([
      aggregate('serviceRequest'),
      aggregate('booking'),
      aggregate('quotation'),
      aggregate('sparePartOrder'),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.providerProfile.count({ where: { deletedAt: null } }),
    ]);

    const days: { date: string; requests: number; bookings: number; quotations: number; sparePartOrders: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - i);
      const key = date.toISOString().slice(0, 10);
      days.push({
        date: key,
        requests: requests[key] || 0,
        bookings: bookings[key] || 0,
        quotations: quotations[key] || 0,
        sparePartOrders: sparePartOrders[key] || 0,
      });
    }

    return {
      days,
      totals: {
        users: totalUsers,
        providers: totalProviders,
      },
    };
  }
}
