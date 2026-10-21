import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifyProviderDto } from './dto/verify-provider.dto';
import {
  AdminOverviewMetrics,
  EscrowLedgerEntry,
  ProviderVerificationRecord,
} from '@weyro/api-contracts';

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
        status: { in: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'REFUNDED'] },
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
      customerName: `${payment.booking?.customer?.firstName || 'Customer'} ${
        payment.booking?.customer?.lastName || ''
      }`.trim(),
      providerName:
        payment.booking?.provider?.businessName || 'Verified Provider',
      amount: Number(payment.amount),
      // No release/payout flow exists yet; completed bookings still hold funds
      // until a disbursement is implemented.
      status:
        payment.status === 'REFUNDED'
          ? 'REFUNDED_TO_CUSTOMER'
          : payment.status === 'RELEASED'
            ? 'RELEASED_TO_PROVIDER'
            : 'HELD_IN_ESCROW',
      confirmedAt: payment.createdAt.toISOString(),
      completedAt: payment.booking?.completedAt
        ? payment.booking.completedAt.toISOString()
        : undefined,
    }));
  }
}
