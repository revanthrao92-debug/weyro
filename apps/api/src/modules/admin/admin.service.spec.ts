import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { formatRef } from '@weyro/api-contracts';
import { AdminService } from './admin.service';
import type { PaymentGateway } from '../payments/interfaces/payment-gateway.interface';

describe('AdminService.refundBooking', () => {
  let service: AdminService;
  let prisma: any;
  let gateway: { refundPayment: jest.Mock };

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn() },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    gateway = {
      refundPayment: jest
        .fn()
        .mockResolvedValue({ refundId: 'rfnd_1', status: 'processed' }),
    };
    service = new AdminService(
      prisma,
      gateway as unknown as PaymentGateway,
    );
  });

  const booking = (status: string) => ({
    id: 'bk-1',
    deletedAt: null,
    payments: [
      {
        id: 'pay-1',
        status,
        amount: 4200,
        gatewayPaymentId: 'pay_gw_1',
      },
    ],
  });

  it('refuses to refund a RELEASED payment', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking('RELEASED'));

    await expect(service.refundBooking('bk-1', 'admin-1')).rejects.toThrow(
      'Illegal Payment status transition',
    );
    expect(gateway.refundPayment).not.toHaveBeenCalled();
  });

  it('claims the payment atomically before calling the gateway', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking('CAPTURED'));

    const result = await service.refundBooking('bk-1', 'admin-1');

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: 'CAPTURED' },
      data: { status: 'REFUNDED' },
    });
    expect(gateway.refundPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay_gw_1' }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'REFUNDED', refundId: 'rfnd_1' });
  });

  it('reuses an existing gateway refund after a timeout', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking('CAPTURED'));
    (gateway as any).findRefund = jest.fn().mockResolvedValue({
      refundId: 'rfnd_existing',
      status: 'processed',
    });

    const result = await service.refundBooking('bk-1', 'admin-1');

    expect(gateway.refundPayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'REFUNDED',
      refundId: 'rfnd_existing',
    });
  });

  it('does not call the gateway when the claim loses a race', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking('CAPTURED'));
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refundBooking('bk-1', 'admin-1')).rejects.toThrow(
      'Payment is no longer refundable',
    );
    expect(gateway.refundPayment).not.toHaveBeenCalled();
  });

  it('reverts the claim when the gateway refund fails', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking('CAPTURED'));
    gateway.refundPayment.mockRejectedValue(new Error('gateway down'));

    await expect(service.refundBooking('bk-1', 'admin-1')).rejects.toThrow(
      'gateway down',
    );
    expect(prisma.payment.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'pay-1', status: 'REFUNDED' },
      data: { status: 'CAPTURED' },
    });
  });
});

describe('AdminService.verifyProvider', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      providerProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new AdminService(prisma, {} as PaymentGateway);
  });

  it('records approval with reviewer and audit trail', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      id: 'provider-1',
      businessName: 'Deccan Auto Care',
      providerType: 'GARAGE',
      phone: '+919876543210',
      address: 'Indiranagar, Bengaluru',
      verificationStatus: 'PENDING',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    prisma.providerProfile.update.mockResolvedValue({
      id: 'provider-1',
      businessName: 'Deccan Auto Care',
      providerType: 'GARAGE',
      phone: '+919876543210',
      address: 'Indiranagar, Bengaluru',
      verificationStatus: 'VERIFIED',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const result = await service.verifyProvider(
      'provider-1',
      { status: 'VERIFIED', auditorNotes: 'GST and ID checked' },
      'admin-1',
    );

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'provider-1' },
      data: expect.objectContaining({
        verificationStatus: 'VERIFIED',
        verifiedBy: 'admin-1',
        auditorNotes: 'GST and ID checked',
        verifiedAt: expect.any(Date),
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'provider.verify',
        actorId: 'admin-1',
        actorRole: 'ADMIN',
        entityId: 'provider-1',
      }),
    });
    expect(result.verificationStatus).toBe('VERIFIED');
  });

  it('rejects a missing provider', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.verifyProvider('missing', { status: 'VERIFIED' }, 'admin-1'),
    ).rejects.toThrow('not found');
    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
  });
});

describe('AdminService.lookup by Weyro reference number', () => {
  const ref = (type: Parameters<typeof formatRef>[0]) => formatRef(type, '261127', 42);
  const any = () => jest.fn<any>();
  const prisma: any = {
    serviceRequest: { findUnique: any() },
    quotation: { findUnique: any() },
    booking: { findUnique: any() },
    sparePartOrder: { findUnique: any() },
    driverBooking: { findUnique: any() },
    payment: { findUnique: any() },
    refund: { findUnique: any() },
  };
  const service = new AdminService(prisma, {} as PaymentGateway);

  it('refuses a mistyped number before touching the database', async () => {
    const good = ref('J');
    const wrong = good.slice(0, -1) + String((Number(good.slice(-1)) + 1) % 10);
    await expect(service.lookup(wrong)).rejects.toThrow('not a valid Weyro reference');
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('each type letter looks in its own table, by the cleaned-up number', async () => {
    const tables: [string, string][] = [
      ['R', 'serviceRequest'], ['Q', 'quotation'], ['J', 'booking'], ['O', 'sparePartOrder'],
      ['T', 'driverBooking'], ['P', 'payment'], ['F', 'refund'],
    ];
    for (const [type, table] of tables) {
      prisma[table].findUnique.mockResolvedValueOnce(null);
      const typed = ref(type as any).toLowerCase().replace(/-/g, ' '); // how someone might type it
      await expect(service.lookup(typed)).rejects.toThrow(`has the reference ${ref(type as any)}`);
      expect(prisma[table].findUnique).toHaveBeenLastCalledWith(expect.objectContaining({ where: { ref: ref(type as any) } }));
    }
  });

  it('a refund shows its payment and job', async () => {
    prisma.refund.findUnique.mockResolvedValueOnce({
      id: 'rf-1', status: 'PROCESSED', amount: 500, createdAt: new Date(),
      payment: { ref: 'P-261127-0001-x', booking: { ref: 'J-261127-0001-x' } },
    });
    const r = await service.lookup(ref('F'));
    expect(r).toMatchObject({ label: 'Refund', amount: 500, linked: ['P-261127-0001-x', 'J-261127-0001-x'] });
  });
});

describe('AdminService.getOverview money in', () => {
  const any = () => jest.fn<any>();
  function prismaWith() {
    return {
      serviceRequest: { count: any().mockResolvedValue(3) },
      quotation: { count: any().mockResolvedValue(2) },
      booking: { count: any().mockResolvedValue(1) },
      providerProfile: { count: any().mockResolvedValue(4) },
      payment: { aggregate: any().mockResolvedValue({ _sum: { amount: 6950 } }) },
      sparePartOrder: { aggregate: any().mockResolvedValue({ _sum: { totalAmount: 43852 } }) },
      driverBooking: { aggregate: any().mockResolvedValue({ _sum: { totalAmount: 598 } }) },
    } as any;
  }

  it('counts paid parts orders and finished trips, not just job payments (was "₹0 collected")', async () => {
    const prisma = prismaWith();
    const r = await new AdminService(prisma, {} as PaymentGateway).getOverview();
    expect(r.moneyIn).toEqual({ total: 6950 + 43852 + 598, jobs: 6950, parts: 43852, trips: 598 });
  });

  it('leaves out refunded and deleted orders, and deleted records in every count', async () => {
    const prisma = prismaWith();
    await new AdminService(prisma, {} as PaymentGateway).getOverview();
    expect(prisma.sparePartOrder.aggregate.mock.calls[0][0].where).toMatchObject({ deletedAt: null, refundedAt: null, paidAt: { not: null } });
    for (const model of ['serviceRequest', 'quotation', 'booking', 'providerProfile']) {
      for (const [args] of prisma[model].count.mock.calls) expect(args.where.deletedAt).toBeNull();
    }
  });

  it('adds up in the database instead of loading every payment', async () => {
    const prisma = prismaWith();
    await new AdminService(prisma, {} as PaymentGateway).getOverview();
    expect(prisma.payment.aggregate).toHaveBeenCalledTimes(1);
    expect(prisma.payment.findMany).toBeUndefined();
  });
});
