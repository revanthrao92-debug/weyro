import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../modules/auth/auth.service';
import { QuotationsService } from '../modules/quotations/quotations.service';
import { PaymentsService } from '../modules/payments/payments.service';
import { RazorpayPaymentGateway } from '../modules/payments/gateways/razorpay.gateway';
import { AuthUserPayload } from '../common/types/auth-user-payload.type';
import * as crypto from 'crypto';

describe('End-to-End Core Integration Suite', () => {
  describe('1. Auth, Refresh Token Rotation, and Constant-Time Non-Existent Lookup', () => {
    let authService: AuthService;
    let mockPrisma: any;
    let mockJwt: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        refreshToken: {
          create: jest.fn(),
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
          deleteMany: jest.fn(),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      mockJwt = {
        signAsync: jest.fn().mockImplementation((payload) => Promise.resolve(`jwt_${payload.sub}`)),
        verifyAsync: jest.fn(),
      };

      authService = new AuthService(mockPrisma, mockJwt);
    });

    it('constant-time dummy bcrypt check occurs when user is not found to prevent timing enumeration', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const startTime = Date.now();
      await expect(
        authService.login({
          emailOrPhone: 'nonexistent@example.in',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
      const elapsed = Date.now() - startTime;

      // Ensure bcrypt comparison was executed even though user did not exist
      expect(elapsed).toBeGreaterThanOrEqual(10);
    });

    it('rotates refresh tokens atomically on /auth/refresh-token', async () => {
      const oldToken = 'old_refresh_token_123';
      const oldHash = crypto.createHash('sha256').update(oldToken).digest('hex');

      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt_1',
        userId: 'user_1',
        tokenHash: oldHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: {
          id: 'user_1',
          email: 'test@example.in',
          phone: '+919876543210',
          role: 'CUSTOMER',
          isActive: true,
        },
      });

      const result = await authService.refreshToken(oldToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt_1' },
          data: { revokedAt: expect.any(Date) },
        }),
      );
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('2. Ownership Gating & Tenant Isolation', () => {
    let quotationsService: QuotationsService;
    let mockPrisma: any;
    let mockNotifications: any;

    beforeEach(() => {
      mockPrisma = {
        serviceRequest: {
          findUnique: jest.fn(),
        },
        quotation: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
      };
      mockNotifications = {
        sendPushNotification: jest.fn().mockResolvedValue({}),
      };

      quotationsService = new QuotationsService(mockPrisma, mockNotifications);
    });

    it('rejects quote acceptance if customer does not own the service request', async () => {
      mockPrisma.booking = { findUnique: jest.fn().mockResolvedValue(null) };
      mockPrisma.quotation.findUnique.mockResolvedValue({
        id: 'quote_1',
        status: 'PENDING',
        requestId: 'req_1',
        providerId: 'prov_1',
        request: {
          id: 'req_1',
          customerId: 'customer_owner_1',
          status: 'OPEN',
        },
      });

      const intruderUser: AuthUserPayload = {
        sub: 'user_intruder',
        email: 'intruder@example.in',
        phone: '+919999999999',
        role: 'CUSTOMER',
        customerProfileId: 'customer_different_2',
      };

      await expect(
        quotationsService.accept('quote_1', intruderUser, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Concurrent Quote Acceptance Race Condition', () => {
    let quotationsService: QuotationsService;
    let mockPrisma: any;
    let mockNotifications: any;

    beforeEach(() => {
      mockNotifications = {
        sendPushNotification: jest.fn().mockResolvedValue({}),
      };
    });

    it('prevents double-acceptance race condition: first transaction succeeds, second throws ConflictException', async () => {
      let acceptCounter = 0;

      mockPrisma = {
        booking: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'booking_winner_1' }),
        },
        quotation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'quote_race',
            status: 'PENDING',
            requestId: 'req_1',
            providerId: 'prov_1',
            totalCost: 5000,
            request: {
              id: 'req_1',
              customerId: 'cust_1',
              status: 'OPEN',
              title: 'Bumper repair',
            },
          }),
          updateMany: jest.fn().mockImplementation((args) => {
            if (args.where.status === 'PENDING') {
              acceptCounter++;
              // First execution gets count: 1, second gets count: 0 (guarded atomic update)
              return Promise.resolve({ count: acceptCounter === 1 ? 1 : 0 });
            }
            return Promise.resolve({ count: 1 });
          }),
        },
        serviceRequest: {
          update: jest.fn().mockResolvedValue({}),
        },
        payment: {
          create: jest.fn().mockResolvedValue({}),
        },
        providerProfile: {
          findUnique: jest.fn().mockResolvedValue({ userId: 'prov_user_1' }),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      quotationsService = new QuotationsService(mockPrisma, mockNotifications);

      const customerUser: AuthUserPayload = {
        sub: 'user_c1',
        email: 'c1@example.in',
        phone: '+919876543210',
        role: 'CUSTOMER',
        customerProfileId: 'cust_1',
      };

      // First accept attempt succeeds
      const firstResult = await quotationsService.accept('quote_race', customerUser, {});
      expect(firstResult).toHaveProperty('id', 'booking_winner_1');

      // Second concurrent accept attempt fails with ConflictException
      await expect(
        quotationsService.accept('quote_race', customerUser, {}),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('4. Webhook Idempotency & Signature Verification', () => {
    let paymentsService: PaymentsService;
    let mockPrisma: any;
    let mockGateway: any;
    let mockNotifications: any;

    beforeEach(() => {
      mockPrisma = {
        webhookEvent: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
        booking: {
          findUnique: jest.fn(),
        },
        payment: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      mockGateway = {
        verifyWebhookSignature: jest.fn().mockReturnValue(true),
      };

      mockNotifications = {
        sendPushNotification: jest.fn().mockResolvedValue({}),
      } as any;

      paymentsService = new PaymentsService(mockPrisma, mockGateway, mockNotifications);
    });

    it('rejects duplicate webhook deliveries idempotently without re-executing transitions', async () => {
      // First webhook delivery: not in DB yet
      mockPrisma.webhookEvent.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'evt_idemp_101', eventId: 'evt_idemp_101' });

      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        status: 'PENDING',
        amount: 5000,
        currency: 'INR',
        booking: { id: 'bk_1', quotation: { totalCost: 5000 } },
      });

      const webhookPayload = {
        id: 'evt_idemp_101',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_123',
              order_id: 'order_123',
              amount: 500000,
              currency: 'INR',
            },
          },
        },
      };

      const rawBody = JSON.stringify(webhookPayload);

      // 1. First execution creates webhook event and captures payment
      const res1 = await paymentsService.handleWebhook(
        rawBody,
        'valid_signature',
        webhookPayload,
      );
      expect(res1.status).toBe('processed');
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalled();

      // 2. Duplicate webhook delivery with same eventId
      const res2 = await paymentsService.handleWebhook(
        rawBody,
        'valid_signature',
        webhookPayload,
      );
      expect(res2).toEqual({ status: 'ignored', reason: 'duplicate', eventId: 'evt_idemp_101' });
      // Payment update should only have been called once across both deliveries
      expect(mockPrisma.payment.update).toHaveBeenCalledTimes(1);
    });
  });
});
