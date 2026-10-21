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
      this.prisma.payment.findMany({ select: { amount: true } }),
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
    const bookings = await this.prisma.booking.findMany({
      include: {
        customer: true,
        provider: true,
        quotation: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((b) => ({
      bookingId: b.id,
      customerName: `${b.customer?.firstName || 'Customer'} ${b.customer?.lastName || ''}`.trim(),
      providerName: b.provider?.businessName || 'Verified Provider',
      amount: Number(b.quotation?.totalCost || 0),
      status:
        b.status === 'COMPLETED'
          ? 'RELEASED_TO_PROVIDER'
          : b.status === 'CANCELLED'
          ? 'REFUNDED_TO_CUSTOMER'
          : 'HELD_IN_ESCROW',
      confirmedAt: b.createdAt.toISOString(),
      completedAt: b.completedAt ? b.completedAt.toISOString() : undefined,
    }));
  }
}
