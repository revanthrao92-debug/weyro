import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
      releasedAt: payment.paidToProviderAt
        ? payment.paidToProviderAt.toISOString()
        : undefined,
      confirmedAt: payment.createdAt.toISOString(),
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
      verificationDocuments: provider.verificationDocuments,
      counts: {
        quotations: _count.quotations,
        bookings: _count.bookings,
        reviews: _count.reviews,
        listings: _count.spareParts,
      },
    };
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
