import { SessionRevocationService } from '../../common/auth/session-revocation.service';
import {
  BadRequestException,
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
import { recordDetail } from './record-detail';
import {
  AdminOverviewMetrics,
  EscrowLedgerEntry,
  parseRef,
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
    @Optional()
    private readonly revocation?: SessionRevocationService,
  ) {}

  async getOverview(): Promise<AdminOverviewMetrics> {
    const live = { deletedAt: null };
    const [
      totalRequests,
      openBroadcasts,
      totalQuotations,
      acceptedQuotations,
      totalBookings,
      completedBookings,
      pendingVerifications,
      verifiedProviders,
      jobPayments,
      partsPaid,
      tripsDone,
    ] = await Promise.all([
      this.prisma.serviceRequest.count({ where: live }),
      this.prisma.serviceRequest.count({ where: { ...live, status: 'OPEN', isBroadcast: true } }),
      this.prisma.quotation.count({ where: live }),
      this.prisma.quotation.count({ where: { ...live, status: 'ACCEPTED' } }),
      this.prisma.booking.count({ where: live }),
      this.prisma.booking.count({ where: { ...live, status: 'COMPLETED' } }),
      this.prisma.providerProfile.count({ where: { ...live, verificationStatus: 'PENDING' } }),
      this.prisma.providerProfile.count({ where: { ...live, verificationStatus: 'VERIFIED' } }),
      // Totals are summed in the database, not by loading every row.
      this.prisma.payment.aggregate({
        where: { ...live, status: { in: ['AUTHORIZED', 'CAPTURED'] } },
        _sum: { amount: true },
      }),
      this.prisma.sparePartOrder.aggregate({
        where: { ...live, paidAt: { not: null }, refundedAt: null },
        _sum: { totalAmount: true },
      }),
      this.prisma.driverBooking.aggregate({
        where: { ...live, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
    ]);

    const jobs = Number(jobPayments._sum.amount ?? 0);
    const parts = Number(partsPaid._sum.totalAmount ?? 0);
    const trips = Number(tripsDone._sum.totalAmount ?? 0);

    return {
      totalRequests,
      openBroadcasts,
      totalQuotations,
      acceptedQuotations,
      totalBookings,
      completedBookings,
      totalEscrowVolume: jobs,
      moneyIn: { total: jobs + parts + trips, jobs, parts, trips },
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
        ref: true,
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
        ref: booking.ref,
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

    // M10: suspension must take effect NOW, not when the access token expires.
    if (dto.status === 'SUSPENDED' && provider.verificationStatus !== 'SUSPENDED') {
      await this.revocation?.revokeUser(provider.userId);
    }

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
      paymentRef: payment.ref,
      bookingRef: payment.booking?.ref,
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
            : payment.status === 'PENDING'
              ? 'AWAITING_PAYMENT' // not paid yet: nothing is held
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

    // Weyro reference number of each logged record (one query per record type on this page).
    const refs = new Map<string, string>();
    const idsOf = (type: string) => [...new Set(items.filter((l) => l.entityType === type && l.entityId).map((l) => l.entityId!))];
    const lookups: [string, (ids: string[]) => Promise<{ id: string; ref: string }[]>][] = [
      ['Booking', (ids) => this.prisma.booking.findMany({ where: { id: { in: ids } }, select: { id: true, ref: true } })],
      ['Payment', (ids) => this.prisma.payment.findMany({ where: { id: { in: ids } }, select: { id: true, ref: true } })],
      ['ServiceRequest', (ids) => this.prisma.serviceRequest.findMany({ where: { id: { in: ids } }, select: { id: true, ref: true } })],
      ['SparePartOrder', (ids) => this.prisma.sparePartOrder.findMany({ where: { id: { in: ids } }, select: { id: true, ref: true } })],
    ];
    await Promise.all(
      lookups.map(async ([type, find]) => {
        const ids = idsOf(type);
        if (ids.length) for (const row of await find(ids)) refs.set(row.id, row.ref);
      }),
    );

    return {
      items: items.map((log) => ({
        ...log,
        entityRef: log.entityId ? (refs.get(log.entityId) ?? null) : null,
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

  /**
   * Find anything by its Weyro reference number (e.g. J-261127-0042-6) and summarise it:
   * what it is, its status, amount, who is involved and the linked reference numbers.
   */
  async lookup(text: string) {
    const parsed = parseRef(text);
    if (!parsed) {
      throw new BadRequestException(
        'That is not a valid Weyro reference. Check the letters and numbers (like J-261127-0042-6) and try again.',
      );
    }
    const { ref, type, label } = parsed;
    const name = (p?: { firstName?: string | null; lastName?: string | null } | null) =>
      p ? [p.firstName, p.lastName].filter(Boolean).join(' ') || null : null;
    const money = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const base = { ref, type, label };
    const notFound = () => new NotFoundException(`No ${label.toLowerCase()} has the reference ${ref}.`);

    switch (type) {
      case 'R': {
        const r = await this.prisma.serviceRequest.findUnique({
          where: { ref },
          include: { customer: true, quotations: { select: { ref: true } } },
        });
        if (!r) throw notFound();
        return { ...base, id: r.id, title: r.title, status: r.status, amount: null, createdAt: r.createdAt,
          customer: name(r.customer), provider: null, linked: r.quotations.map((q) => q.ref) };
      }
      case 'Q': {
        const q = await this.prisma.quotation.findUnique({
          where: { ref },
          include: { request: { select: { ref: true, title: true } }, provider: { select: { businessName: true } }, booking: { select: { ref: true } } },
        });
        if (!q) throw notFound();
        return { ...base, id: q.id, title: q.request.title, status: q.status, amount: money(q.totalCost), createdAt: q.createdAt,
          customer: null, provider: q.provider.businessName, linked: [q.request.ref, q.booking?.ref].filter(Boolean) };
      }
      case 'J': {
        const b = await this.prisma.booking.findUnique({
          where: { ref },
          include: {
            customer: true,
            provider: { select: { businessName: true } },
            quotation: { select: { ref: true, totalCost: true, request: { select: { ref: true, title: true } } } },
            payments: { select: { ref: true } },
          },
        });
        if (!b) throw notFound();
        return { ...base, id: b.id, title: b.quotation.request.title, status: b.status, amount: money(b.quotation.totalCost),
          createdAt: b.createdAt, customer: name(b.customer), provider: b.provider.businessName,
          linked: [b.quotation.request.ref, b.quotation.ref, ...b.payments.map((p) => p.ref)] };
      }
      case 'O': {
        const o = await this.prisma.sparePartOrder.findUnique({
          where: { ref },
          include: { customer: true, provider: { select: { businessName: true } }, sparePart: { select: { name: true } } },
        });
        if (!o) throw notFound();
        return { ...base, id: o.id, title: o.sparePart.name, status: o.status, amount: money(o.totalAmount), createdAt: o.createdAt,
          customer: name(o.customer), provider: o.provider.businessName, linked: [] as string[] };
      }
      case 'T': {
        const t = await this.prisma.driverBooking.findUnique({
          where: { ref },
          include: { customer: true, driver: { select: { businessName: true } } },
        });
        if (!t) throw notFound();
        return { ...base, id: t.id, title: t.pickupAddress, status: t.status, amount: money(t.totalAmount), createdAt: t.createdAt,
          customer: name(t.customer), provider: t.driver.businessName, linked: [] as string[] };
      }
      case 'P': {
        const p = await this.prisma.payment.findUnique({
          where: { ref },
          include: { booking: { select: { ref: true } }, refunds: { select: { ref: true } } },
        });
        if (!p) throw notFound();
        return { ...base, id: p.id, title: 'Payment', status: p.status, amount: money(p.amount), createdAt: p.createdAt,
          customer: null, provider: null, linked: [p.booking.ref, ...p.refunds.map((r) => r.ref)] };
      }
      case 'F': {
        const f = await this.prisma.refund.findUnique({
          where: { ref },
          include: { payment: { select: { ref: true, booking: { select: { ref: true } } } } },
        });
        if (!f) throw notFound();
        return { ...base, id: f.id, title: 'Refund', status: f.status, amount: money(f.amount), createdAt: f.createdAt,
          customer: null, provider: null, linked: [f.payment.ref, f.payment.booking.ref] };
      }
    }
  }

  /** Everything about one record for the admin detail screen (see record-detail.ts). */
  recordDetail(ref: string) {
    return recordDetail(this.prisma, ref);
  }
}
