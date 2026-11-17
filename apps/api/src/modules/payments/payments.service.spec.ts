import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentGateway } from './interfaces/payment-gateway.interface';
import { RazorpayPaymentGateway } from './gateways/razorpay.gateway';
import * as crypto from 'crypto';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockGateway: jest.Mocked<PaymentGateway>;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      booking: {
        findUnique: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      webhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      refund: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'rf-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockGateway = {
      createOrder: jest.fn(),
      verifyPaymentSignature: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      refundPayment: jest.fn(),
    supportsServerBinding: jest.fn().mockReturnValue(true),
      fetchPayment: jest.fn(),
      capturePayment: jest.fn(),
      findRefund: jest.fn().mockResolvedValue(null),
    };

    mockNotifications = {
      sendPushNotification: jest.fn().mockResolvedValue({}),
    } as any;

    service = new PaymentsService(mockPrisma, mockGateway, mockNotifications);
  });

  describe('createOrder', () => {
    it('creates a gateway order with amount in paise and saves gatewayOrderId', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        customerId: 'cust-1',
        status: 'CONFIRMED',
        payments: [
          {
            id: 'pay-1',
            amount: 4500.5,
            currency: 'INR',
            status: 'PENDING',
            gatewayOrderId: null,
          },
        ],
        quotation: { totalCost: 4500.5 },
      });

      mockGateway.createOrder.mockResolvedValue({
        orderId: 'order_rzp_123',
        amount: 450050,
        currency: 'INR',
      });

      const user = {
        sub: 'usr-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
        customerProfileId: 'cust-1',
      };

      const result = await service.createOrder({ bookingId: 'book-1' }, user as any);

      expect(mockGateway.createOrder).toHaveBeenCalledWith({
        amountInPaise: 450050,
        currency: 'INR',
        receipt: 'rcpt_pay-1',
        notes: expect.any(Object),
      });
      // M6: saved with a conditional update so a concurrent create-order cannot overwrite it.
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', gatewayOrderId: null },
        data: { gatewayOrderId: 'order_rzp_123' },
      });
      expect(result.orderId).toBe('order_rzp_123');
    });

    it('M6: when a concurrent request already saved its order, returns that order instead', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        customerId: 'cust-1',
        status: 'CONFIRMED',
        payments: [{ id: 'pay-1', amount: 100, currency: 'INR', status: 'PENDING', gatewayOrderId: null }],
        quotation: { totalCost: 100 },
      });
      mockGateway.createOrder.mockResolvedValue({ orderId: 'order_LOSER', amount: 10000, currency: 'INR' });
      // We lose the race: 0 rows match "gatewayOrderId IS NULL".
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.payment.findUniqueOrThrow = jest.fn().mockResolvedValue({
        id: 'pay-1',
        amount: 100,
        currency: 'INR',
        gatewayOrderId: 'order_WINNER',
      });

      const result = await service.createOrder({ bookingId: 'book-1' }, {
        sub: 'usr-1',
        role: 'CUSTOMER',
        customerProfileId: 'cust-1',
      } as any);

      expect(result.orderId).toBe('order_WINNER');
      expect(result.orderId).not.toBe('order_LOSER');
    });

    it('rejects another customer attempting to create order for booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        customerId: 'cust-1',
        payments: [],
      });

      const hacker = {
        sub: 'usr-2',
        email: 'hacker@example.com',
        role: 'CUSTOMER',
        customerProfileId: 'cust-hacker',
      };

      await expect(
        service.createOrder({ bookingId: 'book-1' }, hacker as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verifyPayment', () => {
    it('verifies signature and transitions payment to CAPTURED', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        customerId: 'cust-1',
        payments: [
          {
            id: 'pay-1',
            status: 'PENDING',
            gatewayOrderId: 'order_123',
            amount: 100,
            currency: 'INR',
          },
        ],
      });

      mockGateway.verifyPaymentSignature.mockReturnValue(true);
      // H2: authoritative gateway fetch must agree with the local record
      (mockGateway.fetchPayment as jest.Mock).mockResolvedValue({
        id: 'pay_rzp_999',
        order_id: 'order_123',
        amount: 10000, // local 100 * 100 paise
        currency: 'INR',
        status: 'captured',
      });
      mockPrisma.payment.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.payment.findUniqueOrThrow = jest.fn().mockResolvedValue({
        id: 'pay-1',
        status: 'CAPTURED',
      });
      mockPrisma.payment.update.mockResolvedValue({
        id: 'pay-1',
        status: 'CAPTURED',
      });

      const user = {
        sub: 'usr-1',
        role: 'CUSTOMER',
        customerProfileId: 'cust-1',
      };

      const result = await service.verifyPayment(
        {
          bookingId: 'book-1',
          orderId: 'order_123',
          paymentId: 'pay_rzp_999',
          signature: 'valid_sig',
        },
        user as any,
      );

      expect(result.status).toBe('CAPTURED');
      expect(mockGateway.verifyPaymentSignature).toHaveBeenCalledWith({
        orderId: 'order_123',
        paymentId: 'pay_rzp_999',
        signature: 'valid_sig',
      });
      expect(mockGateway.fetchPayment).toHaveBeenCalledWith('pay_rzp_999');
      // H3: capture claimed through the conditional updateMany path
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1', status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] } },
        }),
      );
    });

    it('rejects invalid payment signature with 400 Bad Request', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        customerId: 'cust-1',
        payments: [
          {
            id: 'pay-1',
            status: 'PENDING',
            gatewayOrderId: 'order_123',
          },
        ],
      });

      mockGateway.verifyPaymentSignature.mockReturnValue(false);

      const user = {
        sub: 'usr-1',
        role: 'CUSTOMER',
        customerProfileId: 'cust-1',
      };

      await expect(
        service.verifyPayment(
          {
            bookingId: 'book-1',
            orderId: 'order_123',
            paymentId: 'pay_rzp_999',
            signature: 'fake_sig',
          },
          user as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns idempotently if payment is already CAPTURED', async () => {
      const existingCapturedPayment = {
        id: 'pay-1',
        status: 'CAPTURED',
        gatewayOrderId: 'order_123',
      };

      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        customerId: 'cust-1',
        payments: [existingCapturedPayment],
      });

      const user = {
        sub: 'usr-1',
        role: 'CUSTOMER',
        customerProfileId: 'cust-1',
      };

      const result = await service.verifyPayment(
        {
          bookingId: 'book-1',
          orderId: 'order_123',
          paymentId: 'pay_rzp_999',
          signature: 'sig',
        },
        user as any,
      );

      expect(result.status).toBe('ALREADY_CAPTURED');
      expect(mockGateway.verifyPaymentSignature).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('rejects invalid webhook signature with 400 Bad Request', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        service.handleWebhook('{}', 'bad_signature', { event: 'payment.captured' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ignores duplicate webhook event IDs (idempotency)', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'evt-1',
        eventId: 'evt_dup_123',
      });

      const result = await service.handleWebhook(
        '{}',
        'valid_sig',
        { id: 'evt_dup_123', event: 'payment.captured' },
      );

      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('duplicate');
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('rejects webhook payloads without a gateway event id', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);

      await expect(
        service.handleWebhook('{}', 'valid_sig', { event: 'payment.captured' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('M5: an amount/currency mismatch is recorded as rejected and answered 200 (no retry storm)', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        gatewayOrderId: 'order_abc',
        amount: 100,
        currency: 'INR',
      });

      const result = await service.handleWebhook('{}', 'valid_sig', {
        id: 'evt_bad_amount',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_rzp_123', order_id: 'order_abc', amount: 9999, currency: 'INR' },
          },
        },
      });

      // No exception: Razorpay gets a 2xx and stops retrying.
      expect(result).toMatchObject({ status: 'ignored', eventId: 'evt_bad_amount' });
      expect(result).toHaveProperty('reason', expect.stringMatching(/mismatch/));
      // The event is stored, marked rejected, and the payment is untouched.
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { eventId: 'evt_bad_amount' },
        data: { eventType: 'payment.captured#rejected' },
      });
      expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('processes payment.captured event and marks payment CAPTURED', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        gatewayOrderId: 'order_abc',
        amount: 100,
        currency: 'INR',
      });
      mockPrisma.payment.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.payment.findUniqueOrThrow = jest
        .fn()
        .mockResolvedValue({ id: 'pay-1', status: 'CAPTURED' });

      const payload = {
        id: 'evt_new_123',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_123',
              order_id: 'order_abc',
              amount: 10000,
              currency: 'INR',
            },
          },
        },
      };

      const result = await service.handleWebhook('{}', 'valid_sig', payload);

      expect(result.status).toBe('processed');
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: {
          eventId: 'evt_new_123',
          provider: 'RAZORPAY',
          eventType: 'payment.captured',
          payload,
        },
      });
      // H3: capture is claimed via conditional updateMany inside a transaction
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] } },
        data: expect.objectContaining({
          status: 'CAPTURED',
          gatewayPaymentId: 'pay_rzp_123',
        }),
      });
    });

    it('processes payment.failed event and marks payment FAILED', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        gatewayOrderId: 'order_fail',
      });

      const payload = {
        id: 'evt_fail_123',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_123',
              order_id: 'order_fail',
            },
          },
        },
      };

      const result = await service.handleWebhook('{}', 'valid_sig', payload);

      expect(result.status).toBe('processed');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: 'FAILED' },
      });
    });

    describe('M3 – refunds', () => {
      const refundEvent = (event: string, over: Record<string, unknown> = {}) => ({
        id: `evt_${event}_1`,
        event,
        payload: {
          refund: {
            entity: {
              id: 'rfnd_123',
              payment_id: 'pay_captured_123',
              amount: 10000,
              currency: 'INR',
              ...over,
            },
          },
        },
      });
      const paymentRow = (status: string) => ({
        id: 'pay-1',
        bookingId: 'book-1',
        status,
        gatewayPaymentId: 'pay_captured_123',
        amount: 100,
        currency: 'INR',
      });

      beforeEach(() => {
        mockGateway.verifyWebhookSignature.mockReturnValue(true);
        mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      });

      it('refund.processed confirms OUR pending refund: Refund PROCESSED, payment REFUNDED', async () => {
        mockPrisma.payment.findFirst.mockResolvedValue(paymentRow('REFUND_PENDING'));
        mockPrisma.refund.findUnique.mockResolvedValue({
          id: 'rf-1',
          paymentId: 'pay-1',
          gatewayRefundId: 'rfnd_123',
          status: 'PENDING',
        });

        const result = await service.handleWebhook('{}', 'valid_sig', refundEvent('refund.processed'));

        expect(result.status).toBe('processed');
        expect(mockPrisma.refund.updateMany).toHaveBeenCalledWith({
          where: { id: 'rf-1', status: { in: ['PENDING', 'FAILED'] } },
          data: { status: 'PROCESSED', failureReason: null },
        });
        expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
          where: { id: 'pay-1', status: 'REFUND_PENDING' },
          data: { status: 'REFUNDED' },
        });
      });

      it('refund.processed for a refund made in the gateway dashboard is recorded and applied', async () => {
        mockPrisma.payment.findFirst.mockResolvedValue(paymentRow('CAPTURED'));

        await service.handleWebhook('{}', 'valid_sig', refundEvent('refund.processed'));

        expect(mockPrisma.refund.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            paymentId: 'pay-1',
            gatewayRefundId: 'rfnd_123',
            reason: 'gateway_dashboard',
          }),
        });
        expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
          where: { id: 'pay-1', status: 'REFUND_PENDING' },
          data: { status: 'REFUNDED' },
        });
      });

      it('a partial refund leaves the payment status alone', async () => {
        mockPrisma.payment.findFirst.mockResolvedValue(paymentRow('CAPTURED'));
        await service.handleWebhook('{}', 'valid_sig', refundEvent('refund.processed', { amount: 4000 }));
        expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
      });

      it('a refund larger than the payment or in another currency is rejected', async () => {
        mockPrisma.payment.findFirst.mockResolvedValue(paymentRow('REFUND_PENDING'));
        await service.handleWebhook('{}', 'valid_sig', refundEvent('refund.processed', { amount: 99999 }));
        await service.handleWebhook('{}', 'valid_sig', { ...refundEvent('refund.processed', { currency: 'USD' }), id: 'evt_usd' });
        expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
      });

      it('refund.failed: Refund FAILED, payment goes back to CAPTURED, failure is audited', async () => {
        mockPrisma.refund.findUnique.mockResolvedValue({
          id: 'rf-1',
          paymentId: 'pay-1',
          gatewayRefundId: 'rfnd_123',
          status: 'PENDING',
        });
        const errorSpy = jest
          .spyOn((service as unknown as { logger: { error: unknown } }).logger, 'error')
          .mockImplementation(() => undefined);

        const result = await service.handleWebhook(
          '{}',
          'valid_sig',
          refundEvent('refund.failed', { error_description: 'Beneficiary account closed' }),
        );

        expect(result.status).toBe('processed');
        expect(mockPrisma.refund.updateMany).toHaveBeenCalledWith({
          where: { id: 'rf-1', status: { not: 'PROCESSED' } },
          data: { status: 'FAILED', failureReason: 'Beneficiary account closed' },
        });
        expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
          where: { id: 'pay-1', status: 'REFUND_PENDING' },
          data: { status: 'CAPTURED' },
        });
        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ action: 'payment.refund_failed', entityId: 'pay-1' }),
        });
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('NOT refunded'));
      });

      it('refund.failed for an unknown refund is ignored without error', async () => {
        await expect(
          service.handleWebhook('{}', 'valid_sig', refundEvent('refund.failed')),
        ).resolves.toMatchObject({ status: 'processed' });
        expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
      });

      describe('refundCapturedBookingPayment', () => {
        it('records a Refund, asks the gateway, and leaves the payment REFUND_PENDING until the webhook', async () => {
          mockPrisma.payment.findUnique.mockResolvedValue(paymentRow('CAPTURED'));
          mockGateway.refundPayment.mockResolvedValue({ refundId: 'rfnd_new', status: 'pending' });

          const result = await service.refundCapturedBookingPayment('pay-1', {
            reason: 'booking_cancelled',
            actorId: 'usr-1',
            actorRole: 'CUSTOMER',
          });

          expect(result).toEqual({ status: 'REFUND_PENDING', refundId: 'rf-1' });
          // Claimed CAPTURED -> REFUND_PENDING first...
          expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
            where: { id: 'pay-1', status: 'CAPTURED' },
            data: { status: 'REFUND_PENDING' },
          });
          expect(mockPrisma.refund.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ paymentId: 'pay-1', currency: 'INR', reason: 'booking_cancelled' }),
          });
          // ...for the full captured amount...
          expect(mockGateway.refundPayment).toHaveBeenCalledWith(
            expect.objectContaining({ paymentId: 'pay_captured_123', amountInPaise: 10000 }),
          );
          // ...and the gateway refund id is stored. It is NOT REFUNDED yet.
          expect(mockPrisma.refund.update).toHaveBeenCalledWith({
            where: { id: 'rf-1' },
            data: { gatewayRefundId: 'rfnd_new' },
          });
          expect(mockPrisma.payment.updateMany).not.toHaveBeenCalledWith(
            expect.objectContaining({ data: { status: 'REFUNDED' } }),
          );
        });

        it('reuses a refund an earlier timed-out attempt already created at the gateway', async () => {
          mockPrisma.payment.findUnique.mockResolvedValue(paymentRow('CAPTURED'));
          mockGateway.findRefund!.mockResolvedValue({ refundId: 'rfnd_existing', status: 'pending' });

          await service.refundCapturedBookingPayment('pay-1', { reason: 'booking_cancelled' });

          expect(mockGateway.refundPayment).not.toHaveBeenCalled();
          expect(mockPrisma.refund.update).toHaveBeenCalledWith({
            where: { id: 'rf-1' },
            data: { gatewayRefundId: 'rfnd_existing' },
          });
        });

        it('when the gateway refuses: Refund FAILED, payment CAPTURED again, loud log, never throws', async () => {
          mockPrisma.payment.findUnique.mockResolvedValue(paymentRow('CAPTURED'));
          mockGateway.refundPayment.mockRejectedValue(new Error('Insufficient balance for refund'));
          const errorSpy = jest
            .spyOn((service as unknown as { logger: { error: unknown } }).logger, 'error')
            .mockImplementation(() => undefined);

          const result = await service.refundCapturedBookingPayment('pay-1', { reason: 'booking_cancelled' });

          expect(result.status).toBe('FAILED');
          expect(mockPrisma.refund.updateMany).toHaveBeenCalledWith({
            where: { id: 'rf-1', status: { not: 'PROCESSED' } },
            data: { status: 'FAILED', failureReason: 'Insufficient balance for refund' },
          });
          expect(mockPrisma.payment.updateMany).toHaveBeenLastCalledWith({
            where: { id: 'pay-1', status: 'REFUND_PENDING' },
            data: { status: 'CAPTURED' },
          });
          expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('manual follow-up'));
        });

        it('skips payments that are not CAPTURED, and loses gracefully to a concurrent claim', async () => {
          mockPrisma.payment.findUnique.mockResolvedValue(paymentRow('PENDING'));
          expect(await service.refundCapturedBookingPayment('pay-1', { reason: 'x' })).toEqual({ status: 'SKIPPED' });

          mockPrisma.payment.findUnique.mockResolvedValue(paymentRow('CAPTURED'));
          mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 }); // someone else claimed it
          expect(await service.refundCapturedBookingPayment('pay-1', { reason: 'x' })).toEqual({ status: 'SKIPPED' });
          expect(mockGateway.refundPayment).not.toHaveBeenCalled();
          expect(mockPrisma.refund.create).not.toHaveBeenCalled();
        });

        it('with the mock gateway (no webhooks) the refund is confirmed immediately', async () => {
          mockGateway.supportsServerBinding.mockReturnValue(false);
          mockPrisma.payment.findUnique.mockResolvedValue(paymentRow('CAPTURED'));
          mockGateway.refundPayment.mockResolvedValue({ refundId: 'rfnd_mock', status: 'processed' });

          const result = await service.refundCapturedBookingPayment('pay-1', { reason: 'booking_cancelled' });

          expect(result.status).toBe('REFUNDED');
          expect(mockPrisma.payment.updateMany).toHaveBeenLastCalledWith({
            where: { id: 'pay-1', status: 'REFUND_PENDING' },
            data: { status: 'REFUNDED' },
          });
        });
      });
    });

    it('settles a spare-part order on payment.captured', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.sparePartOrder = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'spo-1',
          sparePartId: 'part-1',
          quantity: 2,
          status: 'PENDING',
          totalAmount: 3000,
          currency: 'INR',
        }),
        update: jest.fn().mockResolvedValue({ id: 'spo-1', status: 'PAID' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'spo-1',
          status: 'PAID',
          gatewayPaymentId: 'pay_sp_123',
        }),
      };
      mockPrisma.sparePart = {
        findUnique: jest.fn().mockResolvedValue({ kind: 'PART' }),
        update: jest.fn().mockResolvedValue({ stockQuantity: 3 }),
      };

      const payload = {
        id: 'evt_sp_captured',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_sp_123',
              order_id: 'order_sp_123',
              amount: 300000,
              currency: 'INR',
            },
          },
        },
      };

      const result = await service.handleWebhook('{}', 'valid_sig', payload);

      expect(result.status).toBe('processed');
      expect(mockPrisma.sparePart.update).toHaveBeenCalledWith({
        where: { id: 'part-1' },
        data: { stockQuantity: { decrement: 2 } },
      });
      expect(mockPrisma.sparePartOrder.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'spo-1',
          status: { in: ['PENDING', 'FAILED'] },
        },
        data: expect.objectContaining({
          status: 'PAID',
          gatewayPaymentId: 'pay_sp_123',
        }),
      });
    });

    it('auto-refunds a capture that arrives after cancellation', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockGateway.refundPayment.mockResolvedValue({
        refundId: 'rfnd_cancelled_1',
        status: 'processed',
      } as never);
      (mockGateway as any).findRefund = jest.fn().mockResolvedValue(null);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog = { create: jest.fn().mockResolvedValue({}) };
      mockPrisma.sparePartOrder = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'spo-cancelled',
          sparePartId: 'part-1',
          quantity: 1,
          status: 'CANCELLED',
          totalAmount: 3000,
          currency: 'INR',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };

      const payload = {
        id: 'evt_cancelled_capture',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_cancelled_1',
              order_id: 'order_cancelled_1',
              amount: 300000,
              currency: 'INR',
            },
          },
        },
      };

      const result = await service.handleWebhook('{}', 'valid_sig', payload);

      expect(result.status).toBe('processed');
      expect(mockGateway.refundPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'pay_cancelled_1',
          amountInPaise: 300000,
          notes: expect.objectContaining({
            reason: 'cancelled_after_capture',
          }),
        }),
      );
      expect(mockPrisma.sparePartOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 'spo-cancelled', status: 'CANCELLED' },
        data: { status: 'REFUNDED' },
      });
    });

    it('does not decrement stock for a package webhook capture', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.sparePartOrder = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'spo-pkg',
          sparePartId: 'pkg-1',
          quantity: 1,
          status: 'PENDING',
          totalAmount: 2500,
          currency: 'INR',
        }),
        update: jest.fn().mockResolvedValue({ id: 'spo-pkg', status: 'PAID' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'spo-pkg', status: 'PAID' }),
      };
      mockPrisma.sparePart = {
        findUnique: jest.fn().mockResolvedValue({ kind: 'PACKAGE' }),
        update: jest.fn(),
      };

      await service.handleWebhook('{}', 'valid_sig', {
        id: 'evt_sp_pkg',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_pkg_123',
              order_id: 'order_pkg_123',
              amount: 250000,
              currency: 'INR',
            },
          },
        },
      });

      expect(mockPrisma.sparePart.update).not.toHaveBeenCalled();
      // settle claims the order via the conditional updateMany
      expect(mockPrisma.sparePartOrder.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'spo-pkg',
          status: { in: ['PENDING', 'FAILED'] },
        },
        data: expect.objectContaining({ status: 'PAID' }),
      });
    });

    it('M5: a spare-part webhook with the wrong amount is recorded as rejected, not thrown', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.sparePartOrder = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'spo-1',
          status: 'PENDING',
          totalAmount: 3000,
          currency: 'INR',
        }),
        updateMany: jest.fn(),
      };

      const result = await service.handleWebhook('{}', 'valid_sig', {
        id: 'evt_sp_bad_amount',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_sp_123', order_id: 'order_sp_123', amount: 100, currency: 'INR' },
          },
        },
      });

      expect(result).toMatchObject({ status: 'ignored' });
      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { eventId: 'evt_sp_bad_amount' },
        data: { eventType: 'payment.captured#rejected' },
      });
      expect(mockPrisma.sparePartOrder.updateMany).not.toHaveBeenCalled();
    });

    it('marks a pending spare-part order FAILED on payment.failed', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.sparePartOrder = {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };

      const result = await service.handleWebhook('{}', 'valid_sig', {
        id: 'evt_sp_failed',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: { id: 'pay_sp_failed', order_id: 'order_sp_123' },
          },
        },
      });

      expect(result.status).toBe('processed');
      expect(mockPrisma.sparePartOrder.updateMany).toHaveBeenCalledWith({
        where: { gatewayOrderId: 'order_sp_123', status: 'PENDING' },
        data: { status: 'FAILED' },
      });
    });
  });

  describe('Razorpay HMAC Verification', () => {
    it('verifies valid HMAC SHA256 signature correctly', () => {
      const gateway = new RazorpayPaymentGateway({
        keyId: 'rzp_test_key',
        keySecret: 'rzp_test_secret_12345',
        webhookSecret: 'webhook_secret_12345',
      });
      const rawBody = '{"event":"payment.captured"}';
      const validWebhookSignature = crypto
        .createHmac('sha256', 'webhook_secret_12345')
        .update(rawBody)
        .digest('hex');

      expect(gateway.verifyWebhookSignature(rawBody, validWebhookSignature)).toBe(true);
      expect(gateway.verifyWebhookSignature(rawBody, 'invalid_signature_hex_value_1234567890')).toBe(false);

      const validPaymentSig = crypto
        .createHmac('sha256', 'rzp_test_secret_12345')
        .update('order_123|pay_123')
        .digest('hex');

      expect(
        gateway.verifyPaymentSignature({
          orderId: 'order_123',
          paymentId: 'pay_123',
          signature: validPaymentSig,
        }),
      ).toBe(true);
    });
  });
});
