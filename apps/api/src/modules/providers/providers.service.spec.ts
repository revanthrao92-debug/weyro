import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProvidersService } from './providers.service';
import type { AuthUserPayload } from '../../common/types/auth-user-payload.type';

describe('ProvidersService.submitVerificationDocuments', () => {
  let service: ProvidersService;
  let prisma: any;
  let cache: { del: jest.Mock; getOrSet: jest.Mock };

  const user = {
    sub: 'user-provider-1',
    email: 'provider@example.com',
    phone: '9999999999',
    role: 'PROVIDER',
    providerProfileId: 'provider-1',
  } as AuthUserPayload;

  beforeEach(() => {
    prisma = {
      providerProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.uploadedObject = {
      findMany: jest
        .fn()
        .mockResolvedValue([{ key: 'verification-documents/user-provider-1/gst.pdf' }]),
    };
    cache = { del: jest.fn(), getOrSet: jest.fn() };
    service = new ProvidersService(prisma as any, cache as any);
  });

  it('rejects document keys owned by another account', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      verificationStatus: 'PENDING',
    });

    await expect(
      service.submitVerificationDocuments(user, {
        documents: [
          {
            label: 'GST certificate',
            key: 'verification-documents/user-attacker/doc.pdf',
          },
        ],
      }),
    ).rejects.toThrow('Document keys must be uploads owned by your account');

    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
  });

  it('stores owned keys and returns the provider to the review queue', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      verificationStatus: 'REJECTED',
    });
    prisma.providerProfile.update.mockResolvedValue({
      verificationStatus: 'PENDING',
    });

    const result = await service.submitVerificationDocuments(user, {
      documents: [
        {
          label: 'GST certificate',
          key: 'verification-documents/user-provider-1/gst.pdf',
        },
      ],
    });

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'provider-1' },
      data: expect.objectContaining({
        verificationStatus: 'PENDING',
        verifiedAt: null,
        verifiedBy: null,
        verificationDocuments: {
          'GST certificate':
            'verification-documents/user-provider-1/gst.pdf',
        },
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'provider.documents.submit',
        entityId: 'provider-1',
        newValues: { status: 'PENDING', documentCount: 1 },
      }),
    });
    expect(result).toEqual({
      verificationStatus: 'PENDING',
      documentCount: 1,
    });
  });

  it('H4: rejects document keys that were never finalized', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ verificationStatus: 'PENDING' });
    prisma.uploadedObject.findMany.mockResolvedValue([]);

    await expect(
      service.submitVerificationDocuments(user, {
        documents: [{ label: 'GST certificate', key: 'verification-documents/user-provider-1/gst.pdf' }],
      }),
    ).rejects.toThrow(/not been finalized|not uploaded/);
    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
  });

  it('refuses new documents from a suspended provider', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      verificationStatus: 'SUSPENDED',
    });

    await expect(
      service.submitVerificationDocuments(user, {
        documents: [
          {
            label: 'GST certificate',
            key: 'verification-documents/user-provider-1/gst.pdf',
          },
        ],
      }),
    ).rejects.toThrow('Suspended providers cannot submit');
  });
});

describe('ProvidersService.getAnalytics: where the money comes from', () => {
  function prismaFor(providerType: string) {
    const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
    const any = () => jest.fn<any>();
    return {
      providerProfile: { findUnique: any().mockResolvedValue({ providerType, isAvailable: true }) },
      booking: {
        findMany: any().mockResolvedValue([
          { completedAt: daysAgo(2), quotation: { totalCost: 3000 } },
          { completedAt: daysAgo(3), quotation: { totalCost: 1500 } },
        ]),
      },
      sparePartOrder: {
        findMany: any().mockResolvedValue([]),
        aggregate: any().mockResolvedValue({ _sum: { totalAmount: null } }),
        groupBy: any().mockResolvedValue([]),
      },
      sparePart: { findMany: any().mockResolvedValue([]) },
      driverBooking: {
        findMany: any().mockResolvedValue([{ completedAt: new Date(Date.now() - 86_400_000), driverEarning: 735.54 }]),
      },
      quotation: { count: any().mockResolvedValue(0), aggregate: any().mockResolvedValue({ _sum: { totalCost: null }, _count: 0 }) },
      serviceRequest: { count: any().mockResolvedValue(0) },
    };
  }
  const garage = { sub: 'u1', role: 'PROVIDER', providerProfileId: 'prov-1' } as AuthUserPayload;

  it('a garage earns from completed jobs (was always ₹0: only parts orders counted)', async () => {
    const prisma = prismaFor('GARAGE');
    const r = await new ProvidersService(prisma as any, {} as any).getAnalytics(garage, 30);
    expect(r.earningsFrom).toBe('jobs');
    expect(r.summary.netSales).toBe(4500);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ providerId: 'prov-1', status: 'COMPLETED' }) }),
    );
  });

  it('a garage that also sells parts counts both jobs and parts sales', async () => {
    const prisma = prismaFor('GARAGE');
    prisma.sparePartOrder.findMany.mockResolvedValue([
      { totalAmount: 749, paidAt: new Date(Date.now() - 86_400_000), refundedAt: null, status: 'PAID' },
    ]);
    const r = await new ProvidersService(prisma as any, {} as any).getAnalytics(garage, 30);
    expect(r.summary.netSales).toBe(4500 + 749);
  });

  it('a parts dealer still earns from paid orders', async () => {
    const prisma = prismaFor('PARTS_DEALER');
    const r = await new ProvidersService(prisma as any, {} as any).getAnalytics(garage, 30);
    expect(r.earningsFrom).toBe('parts');
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('a driver earns their share of finished trips', async () => {
    const prisma = prismaFor('DRIVER');
    const r = await new ProvidersService(prisma as any, {} as any).getAnalytics(garage, 30);
    expect(r.earningsFrom).toBe('trips');
    expect(r.summary.netSales).toBe(735.54);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  describe('forecast follows the driver online switch (driverProfile.isOnline, not shop isAvailable)', () => {
    // 90 days with a trip every day, so the forecast has enough history to run.
    const steadyTrips = Array.from({ length: 90 }, (_, i) => ({
      completedAt: new Date(Date.now() - (i + 1) * 86_400_000),
      driverEarning: 700,
    }));
    function driverPrisma(isOnline: boolean) {
      const prisma = prismaFor('DRIVER');
      // isAvailable stays true (its default): only the driver switch may close the forecast.
      prisma.providerProfile.findUnique.mockResolvedValue({ providerType: 'DRIVER', isAvailable: true, driverProfile: { isOnline } });
      prisma.driverBooking.findMany.mockResolvedValue(steadyTrips);
      return prisma;
    }

    it('an offline driver is forecast ₹0 with a driver-worded reason', async () => {
      const r = await new ProvidersService(driverPrisma(false) as any, {} as any).getAnalytics(garage, 30);
      if (!r.forecast.available) throw new Error(`forecast unavailable: ${r.forecast.reason}`);
      expect(r.forecast.projectedTotal).toBe(0);
      const closed = r.forecast.factors.find((f: { key: string }) => f.key === 'closed');
      expect(closed?.label).toBe('You are offline');
    });

    it('an online driver gets a normal forecast', async () => {
      const r = await new ProvidersService(driverPrisma(true) as any, {} as any).getAnalytics(garage, 30);
      if (!r.forecast.available) throw new Error(`forecast unavailable: ${r.forecast.reason}`);
      expect(r.forecast.projectedTotal).toBeGreaterThan(0);
      expect(r.forecast.factors.some((f: { key: string }) => f.key === 'closed')).toBe(false);
    });

    it('a shop keeps using its own switch and wording', async () => {
      const prisma = prismaFor('GARAGE');
      prisma.providerProfile.findUnique.mockResolvedValue({ providerType: 'GARAGE', isAvailable: false, driverProfile: null });
      prisma.booking.findMany.mockResolvedValue(
        Array.from({ length: 90 }, (_, i) => ({ completedAt: new Date(Date.now() - (i + 1) * 86_400_000), quotation: { totalCost: 2000 } })),
      );
      const r = await new ProvidersService(prisma as any, {} as any).getAnalytics(garage, 30);
      if (!r.forecast.available) throw new Error(`forecast unavailable: ${r.forecast.reason}`);
      expect(r.forecast.factors.find((f: { key: string }) => f.key === 'closed')?.label).toBe('Shop is switched off');
    });
  });
});
