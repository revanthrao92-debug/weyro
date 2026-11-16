import { ConflictException } from '@nestjs/common';
import { QuotationsService } from './quotations.service';

/**
 * M3: bookings cannot complete without a CAPTURED payment (admin override is
 * audited), and cancelling a paid booking triggers a gateway refund.
 */
describe('QuotationsService.updateStatus – payment rules (M3)', () => {
  let service: QuotationsService;
  let prisma: any;
  let payments: { refundCapturedBookingPayment: jest.Mock };

  const customer = { sub: 'usr-c', role: 'CUSTOMER', customerProfileId: 'cust-1' } as any;
  const provider = { sub: 'usr-p', role: 'PROVIDER', providerProfileId: 'prov-1' } as any;
  const admin = { sub: 'usr-a', role: 'ADMIN' } as any;

  const bookingRow = (status: string, paymentStatus: string | null) => ({
    id: 'book-1',
    status,
    customerId: 'cust-1',
    providerId: 'prov-1',
    startedAt: new Date(),
    completedAt: null,
    payments: paymentStatus ? [{ id: 'pay-1', status: paymentStatus }] : [],
    quotation: { request: { id: 'req-1', status: 'IN_PROGRESS' } },
  });

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      serviceRequest: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      payment: { findMany: jest.fn().mockResolvedValue([{ id: 'pay-1', status: 'REFUND_PENDING' }]) },
      providerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'usr-p' }) },
      customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'usr-c' }) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    prisma.booking.update.mockImplementation(async ({ data }: any) => ({
      id: 'book-1',
      status: data.status,
      customerId: 'cust-1',
      providerId: 'prov-1',
      payments: [{ id: 'pay-1', status: 'CAPTURED' }],
      quotation: { request: { id: 'req-1' } },
      customer: null,
      provider: null,
    }));
    payments = {
      refundCapturedBookingPayment: jest.fn().mockResolvedValue({ status: 'REFUND_PENDING' }),
    };
    service = new QuotationsService(
      prisma,
      { sendPushNotification: jest.fn().mockResolvedValue({}) } as any,
      payments as any,
    );
  });

  describe('completing', () => {
    it.each(['PENDING', 'AUTHORIZED', 'FAILED', null])(
      'a provider cannot complete a booking whose payment is %s',
      async (paymentStatus) => {
        prisma.booking.findUnique.mockResolvedValue(bookingRow('IN_PROGRESS', paymentStatus));
        await expect(service.updateStatus('book-1', provider, 'COMPLETED')).rejects.toThrow(ConflictException);
        expect(prisma.booking.update).not.toHaveBeenCalled();
      },
    );

    it('completes once the payment is CAPTURED', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRow('IN_PROGRESS', 'CAPTURED'));
      const result: any = await service.updateStatus('book-1', provider, 'COMPLETED');
      expect(result.status).toBe('COMPLETED');
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('an admin can override with a reason, and the override is audit-logged', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRow('IN_PROGRESS', 'PENDING'));
      await service.updateStatus('book-1', admin, 'COMPLETED', { overrideReason: 'Paid in cash on site' });

      expect(prisma.booking.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'usr-a',
          actorRole: 'ADMIN',
          action: 'booking.payment_override',
          entityType: 'Booking',
          entityId: 'book-1',
          oldValues: { status: 'IN_PROGRESS', paymentStatus: 'PENDING' },
          newValues: { status: 'COMPLETED', reason: 'Paid in cash on site' },
        }),
      });
    });

    it('an admin without a reason is refused', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRow('IN_PROGRESS', 'PENDING'));
      await expect(service.updateStatus('book-1', admin, 'COMPLETED')).rejects.toThrow(/admins may override/);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('a provider cannot self-override by sending a reason', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRow('IN_PROGRESS', 'PENDING'));
      await expect(
        service.updateStatus('book-1', provider, 'COMPLETED', { overrideReason: 'trust me' }),
      ).rejects.toThrow(ConflictException);
    });

    it('other transitions are unaffected by an unpaid booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'PENDING'));
      await expect(service.updateStatus('book-1', provider, 'IN_PROGRESS')).resolves.toBeDefined();
    });
  });

  describe('cancelling', () => {
    it('refunds a CAPTURED payment through the gateway and reflects REFUND_PENDING in the response', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'CAPTURED'));

      const result: any = await service.updateStatus('book-1', customer, 'CANCELLED');

      expect(payments.refundCapturedBookingPayment).toHaveBeenCalledWith('pay-1', {
        reason: 'booking_cancelled',
        actorId: 'usr-c',
        actorRole: 'CUSTOMER',
      });
      expect(result.status).toBe('CANCELLED');
      // The response carries the post-refund payment state, not the stale one.
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'book-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('does not touch the gateway when nothing was captured', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'PENDING'));
      await service.updateStatus('book-1', customer, 'CANCELLED');
      expect(payments.refundCapturedBookingPayment).not.toHaveBeenCalled();
    });

    it('a refund exception never un-does the cancellation', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'CAPTURED'));
      payments.refundCapturedBookingPayment.mockRejectedValue(new Error('gateway down'));
      jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

      const result: any = await service.updateStatus('book-1', customer, 'CANCELLED');
      expect(result.status).toBe('CANCELLED');
    });

    it('works without a payments service (unit/legacy construction)', async () => {
      const bare = new QuotationsService(prisma, { sendPushNotification: jest.fn().mockResolvedValue({}) } as any);
      prisma.booking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'CAPTURED'));
      await expect(bare.updateStatus('book-1', customer, 'CANCELLED')).resolves.toBeDefined();
    });
  });
});
