import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
      },
      webhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockGateway = {
      createOrder: jest.fn(),
      verifyPaymentSignature: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      refundPayment: jest.fn(),
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
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { gatewayOrderId: 'order_rzp_123' },
      });
      expect(result.orderId).toBe('order_rzp_123');
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
          },
        ],
      });

      mockGateway.verifyPaymentSignature.mockReturnValue(true);
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

    it('rejects amount/currency mismatches before recording the event', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        gatewayOrderId: 'order_abc',
        amount: 100,
        currency: 'INR',
      });

      await expect(
        service.handleWebhook('{}', 'valid_sig', {
          id: 'evt_bad_amount',
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_rzp_123',
                order_id: 'order_abc',
                amount: 9999,
                currency: 'INR',
              },
            },
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
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
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
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

    it('processes refund.processed event and marks payment REFUNDED', async () => {
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: 'CAPTURED',
        gatewayPaymentId: 'pay_captured_123',
        amount: 100,
        currency: 'INR',
      });

      const payload = {
        id: 'evt_rfnd_123',
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: 'rfnd_123',
              payment_id: 'pay_captured_123',
              amount: 10000,
              currency: 'INR',
            },
          },
        },
      };

      const result = await service.handleWebhook('{}', 'valid_sig', payload);

      expect(result.status).toBe('processed');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: 'REFUNDED' },
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
