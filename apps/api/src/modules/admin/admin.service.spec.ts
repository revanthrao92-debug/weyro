import { describe, it, expect, jest, beforeEach } from '@jest/globals';
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
