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

  // In-memory audit & provider store for resilient offline/dev mode
  private memoryProviders: ProviderVerificationRecord[] = [
    {
      id: 'prov_01',
      businessName: 'Apex OEM Auto Dismantlers',
      providerType: 'PARTS_DEALER',
      phone: '+1 (555) 234-8901',
      address: 'Industrial Parkway Sector 4, Springfield',
      verificationStatus: 'VERIFIED',
      licenseNumber: 'LIC-OEM-89218',
      taxId: 'US-EIN-9921820',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      auditorNotes: 'Verified via state business registry and trade license check.',
    },
    {
      id: 'prov_02',
      businessName: 'Precision Euro-Tech Motors',
      providerType: 'GARAGE',
      phone: '+1 (555) 876-5432',
      address: '404 Oakridge Ave, Springfield',
      verificationStatus: 'PENDING',
      licenseNumber: 'LIC-GAR-44912',
      taxId: 'US-EIN-4412998',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      auditorNotes: 'Awaiting workshop safety certificate verification.',
    },
    {
      id: 'prov_03',
      businessName: 'RapidTire & Brakes Mobile Service',
      providerType: 'MECHANIC',
      phone: '+1 (555) 345-6789',
      address: '12 Metro Blvd, Springfield',
      verificationStatus: 'PENDING',
      licenseNumber: 'LIC-MEC-11029',
      taxId: 'US-EIN-1102934',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      auditorNotes: 'Technician ASE certification attached for review.',
    },
  ];

  async getOverview(): Promise<AdminOverviewMetrics> {
    try {
      const [
        totalRequests,
        openBroadcasts,
        totalQuotations,
        acceptedQuotations,
        totalBookings,
        completedBookings,
        bookings,
        providers,
      ] = await Promise.all([
        this.prisma.serviceRequest.count(),
        this.prisma.serviceRequest.count({ where: { status: 'OPEN' } }),
        this.prisma.quotation.count(),
        this.prisma.quotation.count({ where: { status: 'ACCEPTED' } }),
        this.prisma.booking.count(),
        this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
        this.prisma.booking.findMany({
          include: { quotation: true },
        }),
        this.prisma.providerProfile.findMany(),
      ]);

      const totalEscrowVolume = bookings.reduce(
        (sum, b) => sum + Number(b.quotation?.totalCost || 0),
        0
      );

      const pendingVerifications = providers.filter(
        (p) => p.verificationStatus === 'PENDING'
      ).length;
      const verifiedProviders = providers.filter(
        (p) => p.verificationStatus === 'VERIFIED'
      ).length;

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
    } catch {
      // Offline / dev fallback metrics
      return {
        totalRequests: 8,
        openBroadcasts: 5,
        totalQuotations: 12,
        acceptedQuotations: 3,
        totalBookings: 3,
        completedBookings: 1,
        totalEscrowVolume: 4350,
        pendingVerifications: this.memoryProviders.filter(
          (p) => p.verificationStatus === 'PENDING'
        ).length,
        verifiedProviders: this.memoryProviders.filter(
          (p) => p.verificationStatus === 'VERIFIED'
        ).length,
      };
    }
  }

  async getProviders(status?: string): Promise<ProviderVerificationRecord[]> {
    try {
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
    } catch {
      if (status) {
        return this.memoryProviders.filter((p) => p.verificationStatus === status);
      }
      return this.memoryProviders;
    }
  }

  async verifyProvider(
    id: string,
    dto: VerifyProviderDto
  ): Promise<ProviderVerificationRecord> {
    try {
      const updated = await this.prisma.providerProfile.update({
        where: { id },
        data: {
          verificationStatus: dto.status as any,
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
    } catch {
      const target = this.memoryProviders.find((p) => p.id === id);
      if (!target) {
        throw new NotFoundException(`Provider with ID ${id} not found`);
      }
      target.verificationStatus = dto.status;
      if (dto.auditorNotes) {
        target.auditorNotes = dto.auditorNotes;
      }
      return target;
    }
  }

  async getEscrowLedger(): Promise<EscrowLedgerEntry[]> {
    try {
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
    } catch {
      return [
        {
          bookingId: 'bk_seed_01',
          customerName: 'Marcus Vance',
          providerName: 'Apex OEM Auto Dismantlers',
          amount: 1450,
          status: 'HELD_IN_ESCROW',
          confirmedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          bookingId: 'bk_seed_02',
          customerName: 'Elena Rostova',
          providerName: 'Precision Euro-Tech Motors',
          amount: 820,
          status: 'RELEASED_TO_PROVIDER',
          confirmedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
      ];
    }
  }
}
