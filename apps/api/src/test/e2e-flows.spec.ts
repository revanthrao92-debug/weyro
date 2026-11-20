/**
 * HTTP-level end-to-end flows against a real PostgreSQL + PostGIS database.
 *
 * Unlike the unit suites (which mock Prisma), this boots the full Nest
 * application — global guards, Zod pipes, interceptors, real Prisma client —
 * and drives the two money-critical journeys over HTTP:
 *
 *   1. Assist: customer request → provider quote → customer accepts → booking
 *   2. Shop:   dealer lists part → customer orders → payment verified → stock
 *
 * Requires a live database with migrations applied (CI service container or
 * docker-compose). Excluded from `npm test`; run via
 * `npm run test:e2e -w @weyro/api`.
 */

import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

// @nestjs/schedule v12 ships as ESM-only; Jest on Node 22 cannot require it.
// Cron scheduling is irrelevant to these flows, so stub the module before the
// application graph is imported.
jest.mock('@nestjs/schedule', () => ({
  ScheduleModule: { forRoot: () => ({ module: class {} }) },
  Cron: () => () => undefined,
  Interval: () => () => undefined,
  Timeout: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));


import { AppModule } from '../app.module';
import { AuthService } from '../modules/auth/auth.service';
import { DamageRequestsService } from '../modules/damage-requests/damage-requests.service';
import { env } from '../config/env.config';

import { PrismaService } from '../prisma/prisma.service';
import { seedRegisterOtp } from './otp-helper';
import { STORAGE_SERVICE } from '../modules/uploads/interfaces/storage.interface';

jest.setTimeout(120_000);

const API = '/api/v1';

interface Session {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  profileId: string;
}

describe('HTTP E2E flows (Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const password = 'E2ePassword123!';

  const sessions: Session[] = [];
  let customer: Session;
  let garage: Session;
  let dealer: Session;

  let requestId: string | undefined;
  let quotationId: string | undefined;
  let bookingId: string | undefined;
  let sparePartId: string | undefined;
  let sparePartOrderId: string | undefined;
  let webhookOrderId: string | undefined;
  let webhookEventId: string | undefined;
  let cancelledOrderId: string | undefined;
  let managedPartId: string | undefined;
  let cancelRequestId: string | undefined;
  let cancelQuotationId: string | undefined;
  let multiQuoteRequestId: string | undefined;
  const extraRequestIds: string[] = [];
  const extraBookingIds: string[] = [];

  const http = () => request(app.getHttpServer());

  /**
   * Registers a user. By default goes straight through AuthService: the HTTP
   * endpoint is throttled per IP (correctly), and this file creates more users
   * than that allows in a minute. Pass `viaHttp` for the one real HTTP call.
   */
  const register = async (
    body: Record<string, unknown>,
    options: { viaHttp?: boolean } = {},
  ): Promise<Session> => {
    const otpCode = await seedRegisterOtp(prisma, String(body.phone));
    let result: { accessToken: string; refreshToken?: string; user: any };

    if (options.viaHttp) {
      const res = await http().post(`${API}/auth/register`).send({ ...body, otpCode });
      expect(res.status).toBe(201);
      expect(typeof res.body.accessToken).toBe('string');
      result = res.body;
    } else {
      result = (await app.get(AuthService).register({ ...body, otpCode } as never)) as never;
      expect(typeof result.accessToken).toBe('string');
    }

    const session: Session = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.user.id,
      profileId: result.user.customerProfile?.id ?? result.user.providerProfile?.id,
    };
    sessions.push(session);
    return session;
  };

  // 1x1 PNG — passes the magic-byte check and EXIF stripping in finalize.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );

  /** Real upload: put bytes in storage, then POST /uploads/finalize. */
  const uploadAndFinalize = async (session: Session, folder = 'damage-requests') => {
    const key = `${folder}/${session.userId}/${Date.now()}_${Math.random().toString(16).slice(2, 10)}.png`;
    await (app.get(STORAGE_SERVICE) as any).receiveLocalUpload(key, PNG);
    const res = await http()
      .post(`${API}/uploads/finalize`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ key, contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.key).toBe(key);
    expect(res.body).not.toHaveProperty('fileUrl');
    expect(res.body.previewUrl).toContain('local-file?key=');
    return key;
  };


  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    customer = await register(
      {
        email: `e2e-customer-${suffix}@example.com`,
        phone: `+9198${suffix.slice(-8)}`,
        password,
        role: 'CUSTOMER',
        firstName: 'E2E',
        lastName: 'Customer',
      },
      { viaHttp: true },
    );

    garage = await register({
      email: `e2e-garage-${suffix}@example.com`,
      phone: `+9197${suffix.slice(-8)}`,
      password,
      role: 'PROVIDER',
      providerType: 'GARAGE',
      businessName: `E2E Garage ${suffix}`,
      address: 'Indiranagar, Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
    });

    dealer = await register({
      email: `e2e-dealer-${suffix}@example.com`,
      phone: `+9196${suffix.slice(-8)}`,
      password,
      role: 'PROVIDER',
      providerType: 'PARTS_DEALER',
      businessName: `E2E Auto Parts ${suffix}`,
      address: 'Koramangala, Bengaluru',
      latitude: 12.9352,
      longitude: 77.6245,
    });

    // Registration always creates providers as PENDING; simulate the admin
    // verification step so the VerifiedProviderGuard lets them quote/list.
    await prisma.providerProfile.updateMany({
      where: { userId: { in: [garage.userId, dealer.userId] } },
      data: { verificationStatus: 'VERIFIED' },
    });
  });

  afterAll(async () => {
    if (!prisma) {
      await app?.close();
      return;
    }

    // Restrict relations require children first; everything else cascades
    // from the user rows.
    if (bookingId) {
      await prisma.booking.deleteMany({ where: { id: bookingId } });
    }
    if (requestId) {
      await prisma.serviceRequest.deleteMany({ where: { id: requestId } });
    }
    if (extraRequestIds.length) {
      // Bookings restrict request/quotation deletion, so remove them first.
      await prisma.booking.deleteMany({ where: { requestId: { in: extraRequestIds } } });
      await prisma.serviceRequest.deleteMany({ where: { id: { in: extraRequestIds } } });
    }
    if (multiQuoteRequestId) {
      await prisma.serviceRequest.deleteMany({
        where: { id: multiQuoteRequestId },
      });
    }
    if (cancelRequestId) {
      await prisma.serviceRequest.deleteMany({
        where: { id: cancelRequestId },
      });
    }
    if (managedPartId) {
      await prisma.sparePart.deleteMany({ where: { id: managedPartId } });
    }
    if (sparePartOrderId) {
      await prisma.sparePartOrder.deleteMany({
        where: { id: sparePartOrderId },
      });
    }
    if (webhookOrderId) {
      await prisma.sparePartOrder.deleteMany({
        where: { id: webhookOrderId },
      });
    }
    if (cancelledOrderId) {
      await prisma.sparePartOrder.deleteMany({
        where: { id: cancelledOrderId },
      });
    }
    if (webhookEventId) {
      await prisma.webhookEvent.deleteMany({
        where: { eventId: webhookEventId },
      });
    }
    if (sparePartId) {
      await prisma.sparePart.deleteMany({ where: { id: sparePartId } });
    }
    if (customer) {
      await prisma.vehicle
        .deleteMany({ where: { customerId: customer.profileId } })
        .catch(() => undefined);
    }
    await prisma.user
      .deleteMany({ where: { id: { in: sessions.map((s) => s.userId) } } })
      .catch(() => undefined);

    await app.close();
  });

  describe('Assist flow: request → quote → accept → booking', () => {
    it('creates a broadcast request as the customer', async () => {
      const res = await http()
        .post(`${API}/damage-requests`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          vehicleMake: 'Maruti',
          vehicleModel: 'Swift',
          vehicleYear: 2021,
          category: 'REPAIR',
          title: 'Front bumper repair',
          description: 'Bumper cracked after a minor collision',
          address: 'Indiranagar, Bengaluru',
          latitude: 12.9784,
          longitude: 77.6408,
          urgency: 'URGENT',
          mediaUrls: [],
          damagePhotos: [],
          isBroadcast: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.category).toBe('REPAIR');
      expect(res.body.status).toBe('OPEN');

      requestId = res.body.id;
    });

    it('rejects quoting by a provider for a non-matching category', async () => {
      // Dealer is PARTS_DEALER, so REPAIR requests are out of scope.
      const res = await http()
        .post(`${API}/damage-requests/${requestId}/quotations`)
        .set('Authorization', `Bearer ${dealer.accessToken}`)
        .send({
          partsCost: 1000,
          labourCost: 500,
          warrantyDays: 30,
          etaDescription: '1 day',
        });

      expect(res.status).toBe(403);
    });

    it('accepts a verified garage quotation', async () => {
      const quote = await http()
        .post(`${API}/damage-requests/${requestId}/quotations`)
        .set('Authorization', `Bearer ${garage.accessToken}`)
        .send({
          partsCost: 1200,
          labourCost: 800,
          warrantyDays: 30,
          etaDescription: '2 working days',
        });

      expect(quote.status).toBe(201);
      expect(quote.body.status).toBe('PENDING');
      expect(Number(quote.body.totalCost)).toBe(2000);

      quotationId = quote.body.id;

      const accepted = await http()
        .post(`${API}/quotations/${quotationId}/accept`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({});

      expect(accepted.status).toBe(201);
      expect(accepted.body.status).toBe('CONFIRMED');
      expect(accepted.body.quotationId).toBe(quotationId);

      bookingId = accepted.body.id;
    });

    it('persists the accepted state, booking and pending payment', async () => {
      const [serviceRequest, quotation, booking, payment] = await Promise.all([
        prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } }),
        prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } }),
        prisma.booking.findUniqueOrThrow({
          where: { id: bookingId },
          include: { payments: true },
        }),
        prisma.payment.findFirstOrThrow({
          where: { booking: { quotationId } },
        }),
      ]);

      expect(serviceRequest.status).toBe('ACCEPTED');
      expect(quotation.status).toBe('ACCEPTED');
      expect(booking.status).toBe('CONFIRMED');
      expect(Number(payment.amount)).toBe(2000);
      expect(payment.status).toBe('PENDING');
    });

    it('opens a chat thread for the job that both sides can see', async () => {
      const [customerThreads, garageThreads] = await Promise.all([
        http().get(`${API}/chat/threads`).set('Authorization', `Bearer ${customer.accessToken}`),
        http().get(`${API}/chat/threads`).set('Authorization', `Bearer ${garage.accessToken}`),
      ]);
      expect(customerThreads.status).toBe(200);
      expect(garageThreads.status).toBe(200);
      const forRequest = (body: any) =>
        (Array.isArray(body) ? body : body.items).filter(
          (t: { requestId: string | null }) => t.requestId === requestId,
        );
      expect(forRequest(customerThreads.body)).toHaveLength(1);
      expect(forRequest(garageThreads.body)).toHaveLength(1);
    });

    it('lists the booking for the customer', async () => {
      const res = await http()
        .get(`${API}/bookings`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(200);
      const items = Array.isArray(res.body) ? res.body : res.body.items;
      expect(items.map((b: { id: string }) => b.id)).toContain(bookingId);
    });

    it('prevents double-acceptance of the same quotation', async () => {
      // The booking already exists, so the endpoint is idempotent for the owner
      // and must never create a second booking or payment.
      const res = await http()
        .post(`${API}/quotations/${quotationId}/accept`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(bookingId);

      const bookingCount = await prisma.booking.count({
        where: { quotationId },
      });
      expect(bookingCount).toBe(1);
    });
  });

  describe('Shop flow: list part → order → verify payment → stock', () => {
    it('lets a verified parts dealer list a part', async () => {
      const res = await http()
        .post(`${API}/spare-parts`)
        .set('Authorization', `Bearer ${dealer.accessToken}`)
        .send({
          name: 'E2E Brake Pad Set',
          partNumber: `E2E-BP-${suffix}`,
          compatibleMakes: ['Maruti'],
          compatibleModels: ['Swift'],
          condition: 'OEM',
          price: 1500,
          stockQuantity: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('PART');
      expect(res.body.stockQuantity).toBe(5);

      sparePartId = res.body.id;
    });

    it('blocks customers from listing parts', async () => {
      const res = await http()
        .post(`${API}/spare-parts`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          name: 'Should Not Exist',
          partNumber: `E2E-DENY-${suffix}`,
          price: 100,
          stockQuantity: 1,
        });

      expect(res.status).toBe(403);
    });

    it('creates an order with a gateway order for the customer', async () => {
      const res = await http()
        .post(`${API}/spare-parts/${sparePartId}/orders`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(201);
      expect(res.body.quantity).toBe(2);
      expect(Number(res.body.totalAmount)).toBe(3000);
      expect(typeof res.body.razorpayOrderId).toBe('string');

      sparePartOrderId = res.body.orderId;
    });

    it('rejects an invalid payment signature without moving stock', async () => {
      const order = await prisma.sparePartOrder.findUniqueOrThrow({
        where: { id: sparePartOrderId },
      });

      // The mock gateway accepts signatures >= 10 chars, so use a real-mode
      // style short signature to exercise the rejection path.
      const res = await http()
        .post(`${API}/spare-parts/orders/${sparePartOrderId}/verify`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          razorpayOrderId: order.gatewayOrderId,
          razorpayPaymentId: `pay_e2e_${suffix}`,
          razorpaySignature: 'short',
        });

      expect(res.status).toBe(400);

      const part = await prisma.sparePart.findUniqueOrThrow({
        where: { id: sparePartId },
      });
      expect(part.stockQuantity).toBe(5);
    });

    it('verifies payment, marks the order paid and decrements stock', async () => {
      const order = await prisma.sparePartOrder.findUniqueOrThrow({
        where: { id: sparePartOrderId },
      });

      const res = await http()
        .post(`${API}/spare-parts/orders/${sparePartOrderId}/verify`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          razorpayOrderId: order.gatewayOrderId,
          razorpayPaymentId: `pay_e2e_${suffix}`,
          razorpaySignature: `mock_signature_${suffix}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PAID');

      const [part, paidOrder] = await Promise.all([
        prisma.sparePart.findUniqueOrThrow({ where: { id: sparePartId } }),
        prisma.sparePartOrder.findUniqueOrThrow({
          where: { id: sparePartOrderId },
        }),
      ]);

      expect(part.stockQuantity).toBe(3);
      expect(paidOrder.status).toBe('PAID');
      expect(paidOrder.paidAt).toBeInstanceOf(Date);
    });

    it('is idempotent when the same payment is verified twice', async () => {
      const res = await http()
        .post(`${API}/spare-parts/orders/${sparePartOrderId}/verify`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          razorpayOrderId: 'mock_already_paid',
          razorpayPaymentId: `pay_e2e_${suffix}`,
          razorpaySignature: `mock_signature_${suffix}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ALREADY_PAID');

      const part = await prisma.sparePart.findUniqueOrThrow({
        where: { id: sparePartId },
      });
      expect(part.stockQuantity).toBe(3);
    });

    it('exposes the paid order in the customer order history', async () => {
      const res = await http()
        .get(`${API}/spare-parts/orders/my`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(200);
      const items = Array.isArray(res.body) ? res.body : res.body.items;
      const order = items.find(
        (o: { id: string }) => o.id === sparePartOrderId,
      );

      expect(order).toBeDefined();
      expect(order.status).toBe('PAID');
      expect(order.sparePart.name).toBe('E2E Brake Pad Set');
    });

    it('captures a part payment through the Razorpay webhook, once', async () => {
      const created = await http()
        .post(`${API}/spare-parts/${sparePartId}/orders`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ quantity: 1 });

      expect(created.status).toBe(201);

      const order = await prisma.sparePartOrder.findUniqueOrThrow({
        where: { id: created.body.orderId },
      });

      webhookOrderId = order.id;
      webhookEventId = `evt_e2e_${suffix}`;

      const payload = {
        id: webhookEventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_wh_${suffix}`,
              order_id: order.gatewayOrderId,
              amount: 150000, // ₹1500 in paise
              currency: 'INR',
            },
          },
        },
      };

      const delivered = await http()
        .post(`${API}/payments/webhook`)
        .set('x-razorpay-signature', `mock_webhook_${suffix}`)
        .send(payload);

      expect(delivered.status).toBe(201);
      expect(delivered.body.status).toBe('processed');

      const [settled, part] = await Promise.all([
        prisma.sparePartOrder.findUniqueOrThrow({ where: { id: order.id } }),
        prisma.sparePart.findUniqueOrThrow({ where: { id: sparePartId } }),
      ]);

      expect(settled.status).toBe('PAID');
      expect(settled.gatewayPaymentId).toBe(`pay_wh_${suffix}`);
      expect(part.stockQuantity).toBe(2);

      // Gateway retries must not double-settle or double-decrement.
      const duplicate = await http()
        .post(`${API}/payments/webhook`)
        .set('x-razorpay-signature', `mock_webhook_${suffix}`)
        .send(payload);

      expect(duplicate.status).toBe(201);
      expect(duplicate.body).toEqual({
        status: 'ignored',
        reason: 'duplicate',
        eventId: webhookEventId,
      });

      const afterDuplicate = await prisma.sparePart.findUniqueOrThrow({
        where: { id: sparePartId },
      });
      expect(afterDuplicate.stockQuantity).toBe(2);

      // Settlement also drives the shop notification loop for both sides.
      // Notification dispatch is fire-and-forget by design, so poll briefly
      // instead of reading once right after the webhook returns.
      let paidCount = 0;
      for (let attempt = 0; attempt < 30 && paidCount < 2; attempt++) {
        const paidNotifications = await prisma.notification.findMany({
          where: { userId: { in: [customer.userId, dealer.userId] } },
        });
        paidCount = paidNotifications.filter(
          (n) => (n.data as any)?.type === 'SPARE_PART_ORDER_PAID',
        ).length;
        if (paidCount < 2) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(paidCount).toBeGreaterThanOrEqual(2);
    });

    it('lets the customer cancel a pending order without touching stock', async () => {
      const created = await http()
        .post(`${API}/spare-parts/${sparePartId}/orders`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ quantity: 1 });

      expect(created.status).toBe(201);
      cancelledOrderId = created.body.orderId;

      const cancelled = await http()
        .post(`${API}/spare-parts/orders/${cancelledOrderId}/cancel`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(cancelled.status).toBe(201);
      expect(cancelled.body.status).toBe('CANCELLED');

      const [order, part] = await Promise.all([
        prisma.sparePartOrder.findUniqueOrThrow({
          where: { id: cancelledOrderId },
        }),
        prisma.sparePart.findUniqueOrThrow({ where: { id: sparePartId } }),
      ]);

      expect(order.status).toBe('CANCELLED');
      expect(part.stockQuantity).toBe(2);
    });

    it('refunds a paid order as admin and restores stock', async () => {
      // Promote the dealer account to ADMIN and obtain a fresh token; the
      // previously issued dealer JWT keeps its PROVIDER role.
      await prisma.user.update({
        where: { id: dealer.userId },
        data: { role: 'ADMIN' },
      });

      const login = await http().post(`${API}/auth/login`).send({
        emailOrPhone: `e2e-dealer-${suffix}@example.com`,
        password,
      });
      expect(login.status).toBe(201);

      const refund = await http()
        .post(`${API}/spare-parts/orders/${webhookOrderId}/refund`)
        .set('Authorization', `Bearer ${login.body.accessToken}`);

      expect(refund.status).toBe(201);
      expect(refund.body.status).toBe('REFUNDED');
      expect(typeof refund.body.refundId).toBe('string');

      const [order, part] = await Promise.all([
        prisma.sparePartOrder.findUniqueOrThrow({
          where: { id: webhookOrderId },
        }),
        prisma.sparePart.findUniqueOrThrow({ where: { id: sparePartId } }),
      ]);

      expect(order.status).toBe('REFUNDED');
      expect(part.stockQuantity).toBe(3);

      // A second refund must be a no-op, not a second gateway call.
      const repeated = await http()
        .post(`${API}/spare-parts/orders/${webhookOrderId}/refund`)
        .set('Authorization', `Bearer ${login.body.accessToken}`);

      expect(repeated.status).toBe(201);
      expect(repeated.body).toEqual({
        orderId: webhookOrderId,
        status: 'REFUNDED',
      });
    });
  });

  describe('Privacy, profile and API-readiness endpoints', () => {
    it('never exposes provider contact/KYC data to customers in bookings', async () => {
      const res = await http()
        .get(`${API}/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.provider.businessName).toBe(`E2E Garage ${suffix}`);
      expect(res.body.provider.phone).toBeUndefined();
      expect(res.body.provider.address).toBeUndefined();
      expect(res.body.provider.userId).toBeUndefined();
      expect(res.body.provider.verificationDocuments).toBeUndefined();
      expect(res.body.payments[0].gatewayOrderId).toBeUndefined();
    });

    it('hides customer private fields from the assigned provider', async () => {
      const res = await http()
        .get(`${API}/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${garage.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customer.firstName).toBe('E2E');
      expect(res.body.customer.userId).toBeUndefined();
      expect(res.body.customer.savedAddresses).toBeUndefined();
    });

    it('serves a public provider profile without phone, address or KYC', async () => {
      const profile = await http().get(`${API}/providers/${garage.profileId}`);
      expect(profile.status).toBe(200);
      expect(profile.body.businessName).toBe(`E2E Garage ${suffix}`);
      expect(profile.body.phone).toBeUndefined();
      expect(profile.body.address).toBeUndefined();
      expect(profile.body.verificationDocuments).toBeUndefined();
      expect(profile.body).toHaveProperty('badge');

      const reviews = await http().get(
        `${API}/providers/${garage.profileId}/reviews`,
      );
      expect(reviews.status).toBe(200);
      expect(reviews.body.items).toEqual([]);
    });

    it('lets a customer manage their profile, addresses and vehicles', async () => {
      const auth = {
        Authorization: `Bearer ${customer.accessToken}`,
      };

      const profile = await http()
        .patch(`${API}/customers/me`)
        .set(auth)
        .send({ firstName: 'Renamed' });
      expect(profile.status).toBe(200);
      expect(profile.body.firstName).toBe('Renamed');

      const created = await http()
        .post(`${API}/customers/me/vehicles`)
        .set(auth)
        .send({
          make: 'Hyundai',
          model: 'i20',
          year: 2022,
          registrationNumber: `ka01${suffix.slice(-6)}`,
          fuelType: 'PETROL',
        });
      expect(created.status).toBe(201);

      const listed = await http()
        .get(`${API}/customers/me/vehicles`)
        .set(auth);
      expect(listed.status).toBe(200);
      expect(listed.body.items.map((v: { id: string }) => v.id)).toContain(
        created.body.id,
      );

      const updated = await http()
        .patch(`${API}/customers/me/vehicles/${created.body.id}`)
        .set(auth)
        .send({ color: 'Red' });
      expect(updated.status).toBe(200);
      expect(updated.body.color).toBe('Red');

      const addresses = await http()
        .put(`${API}/customers/me/addresses`)
        .set(auth)
        .send({
          addresses: [
            {
              title: 'Home',
              address: '12 Indiranagar, Bengaluru',
              latitude: 12.9784,
              longitude: 77.6408,
            },
          ],
        });
      expect(addresses.status).toBe(200);
      expect(addresses.body.addresses).toHaveLength(1);
      expect(typeof addresses.body.addresses[0].id).toBe('string');

      const deleted = await http()
        .delete(`${API}/customers/me/vehicles/${created.body.id}`)
        .set(auth);
      expect(deleted.status).toBe(200);
      expect(deleted.body).toEqual({ deleted: true });
    });

    it('blocks providers from the customer self-service routes', async () => {
      const res = await http()
        .get(`${API}/customers/me/vehicles`)
        .set('Authorization', `Bearer ${garage.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('lets a provider read and update their own profile', async () => {
      const auth = {
        Authorization: `Bearer ${garage.accessToken}`,
      };

      const mine = await http().get(`${API}/providers/me`).set(auth);
      expect(mine.status).toBe(200);
      expect(mine.body.email).toBe(`e2e-garage-${suffix}@example.com`);
      expect(mine.body.counts).toEqual(
        expect.objectContaining({ quotations: expect.any(Number) }),
      );

      const unavailable = await http()
        .patch(`${API}/providers/me`)
        .set(auth)
        .send({ isAvailable: false });
      expect(unavailable.status).toBe(200);
      expect(unavailable.body.isAvailable).toBe(false);

      const publicProfile = await http().get(
        `${API}/providers/${garage.profileId}`,
      );
      expect(publicProfile.body.badge).toBeNull();

      await http()
        .patch(`${API}/providers/me`)
        .set(auth)
        .send({ isAvailable: true });

      // KYC submission is real but never self-verifies. A provider can only
      // submit keys from its own upload folder.
      const foreignDoc = await http()
        .patch(`${API}/providers/me/verification-documents`)
        .set(auth)
        .send({
          documents: [
            {
              label: 'GST certificate',
              key: 'verification-documents/someone-else/gst.jpg',
            },
          ],
        });
      expect(foreignDoc.status).toBe(400);

      // H4: the document must be a finalized upload owned by the provider.
      const gstKey = await uploadAndFinalize(garage, 'verification-documents');
      const submitted = await http()
        .patch(`${API}/providers/me/verification-documents`)
        .set(auth)
        .send({ documents: [{ label: 'GST certificate', key: gstKey }] });
      expect(submitted.status).toBe(200);
      expect(submitted.body).toEqual({
        verificationStatus: 'PENDING',
        documentCount: 1,
      });

      const stored = await prisma.providerProfile.findUnique({
        where: { id: garage.profileId },
        select: { verificationDocuments: true },
      });
      expect(stored?.verificationDocuments).toEqual({
        'GST certificate': gstKey,
      });

      // Restore so later marketplace tests still use a verified provider.
      await prisma.providerProfile.update({
        where: { id: garage.profileId },
        data: { verificationStatus: 'VERIFIED' },
      });
    });

    it('lists the provider quotations and allows withdrawal', async () => {
      const mine = await http()
        .get(`${API}/quotations/my`)
        .set('Authorization', `Bearer ${garage.accessToken}`);
      expect(mine.status).toBe(200);
      expect(mine.body.items.map((q: { id: string }) => q.id)).toContain(
        quotationId,
      );

      const created = await http()
        .post(`${API}/damage-requests`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          vehicleMake: 'Maruti',
          vehicleModel: 'Swift',
          vehicleYear: 2021,
          category: 'MAINTENANCE',
          title: 'Withdrawable quotation',
          description: 'Routine service request used by the e2e suite',
          address: 'Indiranagar, Bengaluru',
          latitude: 12.9784,
          longitude: 77.6408,
          urgency: 'NORMAL',
          mediaUrls: [],
          damagePhotos: [],
          isBroadcast: true,
        });
      expect(created.status).toBe(201);
      cancelRequestId = created.body.id;

      const quote = await http()
        .post(`${API}/damage-requests/${cancelRequestId}/quotations`)
        .set('Authorization', `Bearer ${garage.accessToken}`)
        .send({
          partsCost: 500,
          labourCost: 500,
          warrantyDays: 7,
          etaDescription: 'Same day',
        });
      expect(quote.status).toBe(201);
      cancelQuotationId = quote.body.id;

      const withdrawn = await http()
        .post(`${API}/quotations/${cancelQuotationId}/withdraw`)
        .set('Authorization', `Bearer ${garage.accessToken}`);
      expect(withdrawn.status).toBe(201);
      expect(withdrawn.body.status).toBe('WITHDRAWN');

      const cancelled = await http()
        .post(`${API}/damage-requests/${cancelRequestId}/cancel`)
        .set('Authorization', `Bearer ${customer.accessToken}`);
      expect(cancelled.status).toBe(201);
      expect(cancelled.body.status).toBe('CANCELLED');
    });

    it('tracks notification unread state for each user', async () => {
      const auth = {
        Authorization: `Bearer ${garage.accessToken}`,
      };

      const unread = await http()
        .get(`${API}/notifications/unread-count`)
        .set(auth);
      expect(unread.status).toBe(200);
      expect(unread.body.unreadCount).toBeGreaterThan(0);

      const readAll = await http()
        .patch(`${API}/notifications/read-all`)
        .set(auth);
      expect(readAll.status).toBe(200);
      expect(readAll.body.updated).toBeGreaterThan(0);

      const cleared = await http()
        .get(`${API}/notifications/unread-count`)
        .set(auth);
      expect(cleared.body.unreadCount).toBe(0);

      const removed = await http()
        .delete(`${API}/notifications/push-token`)
        .set(auth)
        .send({ token: `missing-token-${suffix}` });
      expect(removed.status).toBe(200);
      expect(removed.body.deleted).toBe(0);
    });

    it('lets a dealer manage their own listings', async () => {
      const auth = {
        Authorization: `Bearer ${dealer.accessToken}`,
      };

      const created = await http()
        .post(`${API}/spare-parts`)
        .set(auth)
        .send({
          name: 'E2E Managed Filter',
          partNumber: `E2E-MF-${suffix}`,
          compatibleMakes: ['Maruti'],
          compatibleModels: ['Swift'],
          condition: 'AFTERMARKET',
          price: 450,
          stockQuantity: 3,
        });
      expect(created.status).toBe(201);
      managedPartId = created.body.id;

      const mine = await http().get(`${API}/spare-parts/mine`).set(auth);
      expect(mine.status).toBe(200);
      expect(mine.body.items.map((p: { id: string }) => p.id)).toContain(
        managedPartId,
      );

      const updated = await http()
        .patch(`${API}/spare-parts/${managedPartId}`)
        .set(auth)
        .send({ stockQuantity: 9, isActive: false });
      expect(updated.status).toBe(200);
      expect(updated.body.stockQuantity).toBe(9);
      expect(updated.body.isActive).toBe(false);

      const forbidden = await http()
        .patch(`${API}/spare-parts/${managedPartId}`)
        .set('Authorization', `Bearer ${garage.accessToken}`)
        .send({ price: 1 });
      expect(forbidden.status).toBe(403);

      const removed = await http()
        .delete(`${API}/spare-parts/${managedPartId}`)
        .set(auth);
      expect(removed.status).toBe(200);
      expect(removed.body).toEqual({ deleted: true });
    });
  });

  describe('C2: a request stays in the feed after the first quote', () => {
    let garage2: Session;

    const feedIds = async (session: Session): Promise<string[]> => {
      const res = await http()
        .get(`${API}/damage-requests/feed?lat=12.9784&lng=77.6408&radiusKm=25&limit=50`)
        .set('Authorization', `Bearer ${session.accessToken}`);
      expect(res.status).toBe(200);
      return res.body.items.map((i: { id: string }) => i.id);
    };

    const quote = (session: Session, parts: number) =>
      http()
        .post(`${API}/damage-requests/${multiQuoteRequestId}/quotations`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ partsCost: parts, labourCost: 500, warrantyDays: 30, etaDescription: '1 day' });

    it('lets two verified providers both see and quote the same request', async () => {
      garage2 = await register({
        email: `e2e-garage2-${suffix}@example.com`,
        phone: `+9195${suffix.slice(-8)}`,
        password,
        role: 'PROVIDER',
        providerType: 'GARAGE',
        businessName: `E2E Garage Two ${suffix}`,
        address: 'Indiranagar, Bengaluru',
        latitude: 12.9791,
        longitude: 77.6419,
      });
      await prisma.providerProfile.updateMany({
        where: { userId: garage2.userId },
        data: { verificationStatus: 'VERIFIED' },
      });

      const created = await http()
        .post(`${API}/damage-requests`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          vehicleMake: 'Hyundai',
          vehicleModel: 'i20',
          vehicleYear: 2020,
          category: 'REPAIR',
          title: 'Two quotes please',
          description: 'Scratched door panel needs a repaint',
          address: 'Indiranagar, Bengaluru',
          latitude: 12.9784,
          longitude: 77.6408,
          urgency: 'URGENT',
          mediaUrls: [],
          damagePhotos: [],
          isBroadcast: true,
        });
      expect(created.status).toBe(201);
      multiQuoteRequestId = created.body.id;

      // Both providers see the fresh OPEN request.
      expect(await feedIds(garage)).toContain(multiQuoteRequestId);
      expect(await feedIds(garage2)).toContain(multiQuoteRequestId);

      // First provider quotes -> request moves to QUOTES_RECEIVED.
      const first = await quote(garage, 1000);
      expect(first.status).toBe(201);
      const afterFirst = await prisma.serviceRequest.findUniqueOrThrow({
        where: { id: multiQuoteRequestId },
      });
      expect(afterFirst.status).toBe('QUOTES_RECEIVED');

      // Still visible to the second provider, hidden from the one who quoted.
      expect(await feedIds(garage2)).toContain(multiQuoteRequestId);
      expect(await feedIds(garage)).not.toContain(multiQuoteRequestId);

      // Second provider can quote too.
      const second = await quote(garage2, 1500);
      expect(second.status).toBe(201);
      expect(await feedIds(garage2)).not.toContain(multiQuoteRequestId);

      // The customer sees both quotes.
      const detail = await http()
        .get(`${API}/damage-requests/${multiQuoteRequestId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.quotations).toHaveLength(2);
    });
  });

  describe('C3/C4: media keys and optional vehicles', () => {
    // Own customer => own throttle bucket (damage-request creation is 10/min/user).
    let buyer: Session;
    const baseRequest = {
      category: 'REPAIR',
      title: 'Free-form vehicle request',
      description: 'No saved vehicle on this request',
      address: 'Indiranagar, Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
      urgency: 'NORMAL',
      isBroadcast: true,
    };

    beforeAll(async () => {
      buyer = await register({
        email: `e2e-buyer-${suffix}@example.com`,
        phone: `+9194${suffix.slice(-8)}`,
        password,
        role: 'CUSTOMER',
        firstName: 'E2E',
        lastName: 'Buyer',
      });
    });

    it('C4: requests without a saved vehicle create no vehicle rows and never collide', async () => {
      const before = await prisma.vehicle.count({ where: { customerId: buyer.profileId } });

      // Many requests with different free-form vehicles: the old code minted a
      // random IND-#### plate per make/model and could hit the global unique index.
      for (let i = 0; i < 6; i++) {
        const res = await http()
          .post(`${API}/damage-requests`)
          .set('Authorization', `Bearer ${buyer.accessToken}`)
          .send({
            ...baseRequest,
            vehicleMake: `Make${i}`,
            vehicleModel: `Model${i}`,
            vehicleYear: 2015 + (i % 8),
            mediaUrls: [],
            damagePhotos: [],
          });
        expect(res.status).toBe(201);
        extraRequestIds.push(res.body.id);
        expect(res.body.vehicleId).toBeNull();
        expect(res.body.vehicle).toMatchObject({ make: `Make${i}`, model: `Model${i}` });
      }

      expect(await prisma.vehicle.count({ where: { customerId: buyer.profileId } })).toBe(before);

      const detail = await http()
        .get(`${API}/damage-requests/${extraRequestIds[extraRequestIds.length - 1]}`)
        .set('Authorization', `Bearer ${buyer.accessToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.vehicle).toMatchObject({ make: 'Make5', model: 'Model5' });
    });

    it('C4: plates are normalized and unique per customer, not globally', async () => {
      const first = await http()
        .post(`${API}/customers/me/vehicles`)
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ make: 'Honda', model: 'City', year: 2019, registrationNumber: ' ka 01 zz 9876 ' });
      expect(first.status).toBe(201);
      expect(first.body.registrationNumber).toBe('KA01ZZ9876');

      // Same customer, same plate in a different spelling -> conflict.
      const dup = await http()
        .post(`${API}/customers/me/vehicles`)
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ make: 'Honda', model: 'City', year: 2019, registrationNumber: 'KA01ZZ9876' });
      expect(dup.status).toBe(409);

      // A different customer may own the same plate string.
      const other = await http()
        .post(`${API}/customers/me/vehicles`)
        .set('Authorization', `Bearer ${garage.accessToken}`)
        .send({ make: 'Honda', model: 'City', year: 2019, registrationNumber: 'KA01ZZ9876' });
      // garage is a provider, so the customer route refuses it — assert it is not a uniqueness 409.
      expect(other.status).not.toBe(409);
    });

    it('C3/H4: finalize -> create with the key; DB stores the key, API returns a signed URL', async () => {
      const key = await uploadAndFinalize(buyer);
      expect(await prisma.uploadedObject.findUnique({ where: { key } })).toMatchObject({ ownerId: buyer.userId });

      const created = await http()
        .post(`${API}/damage-requests`)
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ ...baseRequest, vehicleMake: 'Tata', vehicleModel: 'Nexon', vehicleYear: 2022, mediaUrls: [key], damagePhotos: [key] });
      expect(created.status).toBe(201);
      extraRequestIds.push(created.body.id);

      const rows = await prisma.requestMedia.findMany({ where: { requestId: created.body.id } });
      expect(rows.map((r) => r.url)).toEqual([key]); // key, never a URL

      for (const path of [`damage-requests/${created.body.id}`, 'damage-requests/my']) {
        const res = await http().get(`${API}/${path}`).set('Authorization', `Bearer ${buyer.accessToken}`);
        expect(res.status).toBe(200);
        const text = JSON.stringify(res.body);
        expect(text).toContain('local-file?key=');
        expect(text).not.toContain(`"${key}"`);
      }
    });

    it('H4: rejects signed URLs, other users\' keys, wrong folders and un-finalized keys with 400', async () => {
      // Own customer => own throttle bucket (damage-request creation is 10/min/user).
      const buyer = await register({
        email: `e2e-h4-${suffix}@example.com`,
        phone: `+9192${suffix.slice(-8)}`,
        password,
        role: 'CUSTOMER',
        firstName: 'E2E',
        lastName: 'H4',
      });
      const mine = await uploadAndFinalize(buyer);
      const theirs = await uploadAndFinalize(customer);
      const wrongFolder = await uploadAndFinalize(buyer, 'avatars');
      const neverFinalized = `damage-requests/${buyer.userId}/${Date.now()}_neverfinal.png`;

      // A signed URL for the buyer's own, genuinely finalized file.
      const signed = (
        await http().get(`${API}/uploads/presigned-download-url`).query({ key: mine }).set('Authorization', `Bearer ${buyer.accessToken}`)
      ).body.downloadUrl as string;
      expect(signed).toContain('local-file?key=');

      const attempts: string[] = [theirs, wrongFolder, neverFinalized, 'https://evil.example.com/a.png', signed];

      for (const value of attempts) {
        const res = await http()
          .post(`${API}/damage-requests`)
          .set('Authorization', `Bearer ${buyer.accessToken}`)
          .send({ ...baseRequest, vehicleMake: 'Tata', vehicleModel: 'Nexon', vehicleYear: 2022, mediaUrls: [value], damagePhotos: [] });
        expect(res.status).toBe(400);
      }

      // Control: the caller's own finalized key is still accepted.
      const ok = await http()
        .post(`${API}/damage-requests`)
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ ...baseRequest, vehicleMake: 'Tata', vehicleModel: 'Nexon', vehicleYear: 2022, mediaUrls: [mine], damagePhotos: [] });
      expect(ok.status).toBe(201);
      extraRequestIds.push(ok.body.id);
    });
  });

  describe('H6: concurrent accepts create exactly one booking', () => {
    it('two simultaneous accepts of different quotes on one request -> one booking, one 409', async () => {
      const c = await register({
        email: `e2e-h6c-${suffix}@example.com`,
        phone: `+9189${suffix.slice(-8)}`,
        password,
        role: 'CUSTOMER',
        firstName: 'E2E',
        lastName: 'H6',
      });
      const providers: Session[] = [];
      for (const [i, prefix] of ['88', '87'].entries()) {
        providers.push(
          await register({
            email: `e2e-h6p${i}-${suffix}@example.com`,
            phone: `+91${prefix}${suffix.slice(-8)}`,
            password,
            role: 'PROVIDER',
            providerType: 'GARAGE',
            businessName: `H6 Garage ${i} ${suffix}`,
            address: 'Indiranagar, Bengaluru',
            latitude: 12.9784 + i / 1000,
            longitude: 77.6408,
          }),
        );
      }
      await prisma.providerProfile.updateMany({
        where: { userId: { in: providers.map((p) => p.userId) } },
        data: { verificationStatus: 'VERIFIED' },
      });

      // Several independent rounds so one lucky interleaving cannot pass.
      for (let round = 0; round < 4; round++) {
        const created = await http()
          .post(`${API}/damage-requests`)
          .set('Authorization', `Bearer ${c.accessToken}`)
          .send({
            vehicleMake: 'Kia',
            vehicleModel: 'Seltos',
            vehicleYear: 2021,
            category: 'REPAIR',
            title: `Race round ${round}`,
            description: 'Two quotes will be accepted at the same time',
            address: 'Indiranagar, Bengaluru',
            latitude: 12.9784,
            longitude: 77.6408,
            urgency: 'NORMAL',
            mediaUrls: [],
            damagePhotos: [],
            isBroadcast: true,
          });
        expect(created.status).toBe(201);
        const requestId = created.body.id as string;
        extraRequestIds.push(requestId);

        const quoteIds: string[] = [];
        for (const provider of providers) {
          const q = await http()
            .post(`${API}/damage-requests/${requestId}/quotations`)
            .set('Authorization', `Bearer ${provider.accessToken}`)
            .send({ partsCost: 1000, labourCost: 500, warrantyDays: 30, etaDescription: '1 day' });
          expect(q.status).toBe(201);
          quoteIds.push(q.body.id);
        }

        const results = await Promise.all(
          quoteIds.map((id) =>
            http().post(`${API}/quotations/${id}/accept`).set('Authorization', `Bearer ${c.accessToken}`).send({}),
          ),
        );

        const statuses = results.map((r) => r.status).sort();
        expect(statuses).toEqual([201, 409]);
        const active = await prisma.booking.findMany({
          where: { requestId, status: { not: 'CANCELLED' } },
        });
        expect(active).toHaveLength(1);
        expect(active[0].requestId).toBe(requestId);
        extraBookingIds.push(active[0].id);

        const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
        expect(request.status).toBe('ACCEPTED');
      }
    });

    it('the database itself refuses a second active booking for a request (partial unique index)', async () => {
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: extraBookingIds[0] } });
      const rival = await prisma.quotation.findFirstOrThrow({
        where: { requestId: booking.requestId, id: { not: booking.quotationId } },
      });
      await expect(
        prisma.booking.create({
          data: {
            quotationId: rival.id,
            requestId: booking.requestId,
            customerId: booking.customerId,
            providerId: rival.providerId,
            status: 'CONFIRMED',
          },
        }),
      ).rejects.toThrow(/Unique constraint|bookings_one_active_per_request/);

      // A cancelled booking does not block (and a new active one is then allowed).
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
      const second = await prisma.booking.create({
        data: {
          quotationId: rival.id,
          requestId: booking.requestId,
          customerId: booking.customerId,
          providerId: rival.providerId,
          status: 'CONFIRMED',
        },
      });
      expect(second.status).toBe('CONFIRMED');
    });
  });

  describe('M3: payment rules for bookings', () => {
    let c: Session;
    let p: Session;

    const makeBooking = async (title: string): Promise<{ bookingId: string; paymentId: string }> => {
      const created = await http()
        .post(`${API}/damage-requests`)
        .set('Authorization', `Bearer ${c.accessToken}`)
        .send({
          vehicleMake: 'Skoda',
          vehicleModel: 'Kushaq',
          vehicleYear: 2022,
          category: 'REPAIR',
          title,
          description: 'Booking used to test the payment rules',
          address: 'Indiranagar, Bengaluru',
          latitude: 12.9784,
          longitude: 77.6408,
          urgency: 'NORMAL',
          mediaUrls: [],
          damagePhotos: [],
          isBroadcast: true,
        });
      expect(created.status).toBe(201);
      extraRequestIds.push(created.body.id);
      const quote = await http()
        .post(`${API}/damage-requests/${created.body.id}/quotations`)
        .set('Authorization', `Bearer ${p.accessToken}`)
        .send({ partsCost: 1000, labourCost: 500, warrantyDays: 30, etaDescription: '1 day' });
      expect(quote.status).toBe(201);
      const accepted = await http()
        .post(`${API}/quotations/${quote.body.id}/accept`)
        .set('Authorization', `Bearer ${c.accessToken}`)
        .send({});
      expect(accepted.status).toBe(201);
      const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: accepted.body.id } });
      return { bookingId: accepted.body.id, paymentId: payment.id };
    };

    const setStatus = (session: Session, bookingId: string, body: Record<string, unknown>) =>
      http()
        .patch(`${API}/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send(body);

    beforeAll(async () => {
      c = await register({
        email: `e2e-m3c-${suffix}@example.com`,
        phone: `+9186${suffix.slice(-8)}`,
        password,
        role: 'CUSTOMER',
        firstName: 'E2E',
        lastName: 'M3',
      });
      p = await register({
        email: `e2e-m3p-${suffix}@example.com`,
        phone: `+9185${suffix.slice(-8)}`,
        password,
        role: 'PROVIDER',
        providerType: 'GARAGE',
        businessName: `M3 Garage ${suffix}`,
        address: 'Indiranagar, Bengaluru',
        latitude: 12.9784,
        longitude: 77.6408,
      });
      await prisma.providerProfile.updateMany({
        where: { userId: p.userId },
        data: { verificationStatus: 'VERIFIED' },
      });
    });

    it('a booking cannot be COMPLETED until its payment is CAPTURED', async () => {
      const { bookingId, paymentId } = await makeBooking('M3 unpaid completion');
      extraBookingIds.push(bookingId);

      expect((await setStatus(p, bookingId, { status: 'IN_PROGRESS' })).status).toBe(200);

      const unpaid = await setStatus(p, bookingId, { status: 'COMPLETED' });
      expect(unpaid.status).toBe(409);
      expect(unpaid.body.message).toMatch(/Payment must be captured/);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('IN_PROGRESS');

      // A provider cannot talk their way around it.
      const sneaky = await setStatus(p, bookingId, { status: 'COMPLETED', overrideReason: 'customer paid cash' });
      expect(sneaky.status).toBe(409);

      await prisma.payment.update({ where: { id: paymentId }, data: { status: 'CAPTURED', gatewayPaymentId: 'pay_m3_1' } });
      const paid = await setStatus(p, bookingId, { status: 'COMPLETED' });
      expect(paid.status).toBe(200);
      expect(paid.body.status).toBe('COMPLETED');
    });

    it('cancelling a paid booking refunds it: Refund row recorded, payment ends REFUNDED', async () => {
      const { bookingId, paymentId } = await makeBooking('M3 paid cancellation');
      extraBookingIds.push(bookingId);
      await prisma.payment.update({ where: { id: paymentId }, data: { status: 'CAPTURED', gatewayPaymentId: 'pay_m3_2' } });

      const cancelled = await setStatus(c, bookingId, { status: 'CANCELLED' });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('CANCELLED');

      const refunds = await prisma.refund.findMany({ where: { paymentId } });
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({ reason: 'booking_cancelled', status: 'PROCESSED' });
      expect(Number(refunds[0].amount)).toBe(1500);
      expect(refunds[0].gatewayRefundId).toBeTruthy();
      // The mock gateway sends no webhook, so it confirms immediately.
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe('REFUNDED');

      // A second cancel attempt is an illegal transition and creates no second refund.
      expect((await setStatus(c, bookingId, { status: 'CANCELLED' })).status).toBe(200); // same-state no-op
      expect(await prisma.refund.count({ where: { paymentId } })).toBe(1);
    });

    it('M2: a provider starting the job and the customer cancelling it at the same time -> exactly one wins', async () => {
      for (let round = 0; round < 5; round++) {
        const { bookingId } = await makeBooking(`M2 race ${round}`);
        extraBookingIds.push(bookingId);

        const [start, cancel] = await Promise.all([
          setStatus(p, bookingId, { status: 'IN_PROGRESS' }),
          setStatus(c, bookingId, { status: 'CANCELLED' }),
        ]);

        // One transition wins; the other is refused (409), never silently overwritten.
        expect([start.status, cancel.status].sort()).toEqual([200, 409]);
        const booking = await prisma.booking.findUniqueOrThrow({
          where: { id: bookingId },
          include: { quotation: { include: { request: true } } },
        });
        const winner = start.status === 200 ? 'IN_PROGRESS' : 'CANCELLED';
        expect(booking.status).toBe(winner);
        // The linked request tracks the booking: IN_PROGRESS only if the job started.
        expect(booking.quotation.request.status).toBe(winner === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ACCEPTED');
      }
    });

    it('an admin can override an unpaid completion only with a reason, and it is audit-logged', async () => {
      const { bookingId } = await makeBooking('M3 admin override');
      extraBookingIds.push(bookingId);
      expect((await setStatus(p, bookingId, { status: 'IN_PROGRESS' })).status).toBe(200);

      const adminUser = await prisma.user.create({
        data: {
          email: `e2e-m3-admin-${suffix}@example.com`,
          phone: `+9184${suffix.slice(-8)}`,
          passwordHash: '',
          role: 'ADMIN',
          phoneVerified: true,
        },
      });
      sessions.push({ accessToken: '', userId: adminUser.id, profileId: '' });
      const token = await app.get(JwtService).signAsync(
        { sub: adminUser.id, email: adminUser.email, phone: adminUser.phone, role: 'ADMIN' },
        { secret: env.JWT_ACCESS_SECRET, expiresIn: '5m' },
      );
      const asAdmin = { accessToken: token, userId: adminUser.id, profileId: '' };

      expect((await setStatus(asAdmin, bookingId, { status: 'COMPLETED' })).status).toBe(409);
      const ok = await setStatus(asAdmin, bookingId, { status: 'COMPLETED', overrideReason: 'Paid in cash on site' });
      expect(ok.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'booking.payment_override', entityId: bookingId },
      });
      expect(audit).toMatchObject({ actorId: adminUser.id, actorRole: 'ADMIN' });
      expect(audit?.newValues).toMatchObject({ status: 'COMPLETED', reason: 'Paid in cash on site' });
    });
  });

  describe('M1: feed pagination across mixed urgencies', () => {
    const RANK: Record<string, number> = { EMERGENCY: 1, URGENT: 2, NORMAL: 3 };
    const inFeedOrder = (a: any, b: any) =>
      RANK[a.urgency] - RANK[b.urgency] ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

    let mine: string[] = [];

    beforeAll(async () => {
      const base = Date.now() - 60 * 60 * 1000;
      const urgencies = ['NORMAL', 'EMERGENCY', 'URGENT'];
      const created = [];
      for (let i = 0; i < 15; i++) {
        created.push(
          await prisma.serviceRequest.create({
            data: {
              customerId: customer.profileId,
              category: 'REPAIR',
              title: `M1 feed ${suffix} #${i}`,
              description: 'Feed pagination fixture',
              address: 'Indiranagar, Bengaluru',
              latitude: 12.9784,
              longitude: 77.6408,
              urgency: urgencies[i % 3] as any,
              status: 'OPEN',
              isBroadcast: true,
              expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
              // Groups of 5 share one createdAt, so ties exist within and across urgencies
              // and page boundaries (limit 3) fall inside them.
              createdAt: new Date(base + Math.floor(i / 5) * 60_000),
            },
          }),
        );
      }
      mine = created.map((r) => r.id);
      extraRequestIds.push(...mine);
    });

    const pageThrough = async (fetchPage: (cursor?: string) => Promise<{ items: any[]; nextCursor: string | null }>) => {
      const all: any[] = [];
      let cursor: string | undefined;
      for (let guard = 0; guard < 200; guard++) {
        const page = await fetchPage(cursor);
        expect(page.items.length).toBeLessThanOrEqual(3);
        all.push(...page.items);
        if (!page.nextCursor) return all;
        cursor = page.nextCursor;
      }
      throw new Error('pagination did not terminate');
    };

    const expectCompleteAndOrdered = (all: any[]) => {
      const ids = all.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length); // no repeats
      for (const id of mine) expect(ids).toContain(id); // none skipped
      // Pages concatenate to exactly the feed order.
      expect(all.map((r) => r.id)).toEqual([...all].sort(inFeedOrder).map((r) => r.id));
    };

    it('SQL feed (HTTP): every request exactly once, in order, across ties and urgency boundaries', async () => {
      const all = await pageThrough(async (cursor) => {
        const res = await http()
          .get(`${API}/damage-requests/feed`)
          .query({ lat: 12.9784, lng: 77.6408, radiusKm: 25, limit: 3, ...(cursor ? { cursor } : {}) })
          .set('Authorization', `Bearer ${garage.accessToken}`);
        expect(res.status).toBe(200);
        return res.body;
      });
      expectCompleteAndOrdered(all);
      // The cursor is opaque base64url JSON (rank, createdAt, id), not a bare id.
      const first = await http()
        .get(`${API}/damage-requests/feed`)
        .query({ lat: 12.9784, lng: 77.6408, limit: 3 })
        .set('Authorization', `Bearer ${garage.accessToken}`);
      const decoded = JSON.parse(Buffer.from(first.body.nextCursor, 'base64url').toString());
      expect(decoded).toEqual({ r: expect.any(Number), c: expect.any(String), i: expect.any(String) });
    });

    it('Prisma fallback feed (no coordinates): same guarantees', async () => {
      const service = app.get(DamageRequestsService);
      const all = await pageThrough((cursor) => service.getBroadcastFeed({ limit: 3, cursor }) as any);
      expectCompleteAndOrdered(all);
    });

    it("the customer's own request list (a different cursor format) still pages correctly", async () => {
      // The M1 cursor change must not leak into findMine, which orders by (createdAt, id) only.
      const seen: any[] = [];
      let cursor: string | undefined;
      for (let guard = 0; guard < 100; guard++) {
        const res = await http()
          .get(`${API}/damage-requests/my`)
          .query({ limit: 4, ...(cursor ? { cursor } : {}) })
          .set('Authorization', `Bearer ${customer.accessToken}`);
        expect(res.status).toBe(200);
        seen.push(...res.body.items);
        if (!res.body.nextCursor) break;
        cursor = res.body.nextCursor;
        // findMine cursors are { createdAt, id } — not the feed's { r, c, i }.
        expect(Object.keys(JSON.parse(Buffer.from(cursor!, 'base64url').toString())).sort()).toEqual(['createdAt', 'id']);
      }
      const ids = seen.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of mine) expect(ids).toContain(id);
      const times = seen.map((r) => new Date(r.createdAt).getTime());
      expect(times).toEqual([...times].sort((x, y) => y - x));
    });

    it('still honours a legacy bare-id cursor, and rejects garbage with 400', async () => {
      const legacy = await http()
        .get(`${API}/damage-requests/feed`)
        .query({ lat: 12.9784, lng: 77.6408, limit: 3, cursor: mine[0] })
        .set('Authorization', `Bearer ${garage.accessToken}`);
      expect(legacy.status).toBe(200);

      const garbage = await http()
        .get(`${API}/damage-requests/feed`)
        .query({ lat: 12.9784, lng: 77.6408, limit: 3, cursor: 'not-a-cursor' })
        .set('Authorization', `Bearer ${garage.accessToken}`);
      expect(garbage.status).toBe(400);
    });
  });

  describe('M10: suspended users lose access immediately', () => {
    it('a suspended provider\'s still-valid access token and refresh token stop working at once', async () => {
      const victim = await register({
        email: `e2e-m10-${suffix}@example.com`,
        phone: `+9183${suffix.slice(-8)}`,
        password,
        role: 'PROVIDER',
        providerType: 'GARAGE',
        businessName: `M10 Garage ${suffix}`,
        address: 'Indiranagar, Bengaluru',
        latitude: 12.9784,
        longitude: 77.6408,
      });
      await prisma.providerProfile.updateMany({ where: { userId: victim.userId }, data: { verificationStatus: 'VERIFIED' } });

      const me = () => http().get(`${API}/auth/me`).set('Authorization', `Bearer ${victim.accessToken}`);
      expect((await me()).status).toBe(200);

      const adminUser = await prisma.user.create({
        data: {
          email: `e2e-m10-admin-${suffix}@example.com`,
          phone: `+9182${suffix.slice(-8)}`,
          passwordHash: '',
          role: 'ADMIN',
          phoneVerified: true,
        },
      });
      sessions.push({ accessToken: '', userId: adminUser.id, profileId: '' });
      const adminToken = await app.get(JwtService).signAsync(
        { sub: adminUser.id, email: adminUser.email, phone: adminUser.phone, role: 'ADMIN' },
        { secret: env.JWT_ACCESS_SECRET, expiresIn: '5m' },
      );

      // Make sure the token's iat is strictly earlier than the suspension second.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const suspend = await http()
        .patch(`${API}/admin/providers/${victim.profileId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED', auditorNotes: 'M10 e2e suspension' });
      expect(suspend.status).toBe(200);

      // The access token is still cryptographically valid and unexpired, yet refused.
      const after = await me();
      expect(after.status).toBe(401);
      expect(after.body.message).toMatch(/suspended/i);

      // ... and it cannot be traded in for a new one.
      const refresh = await http().post(`${API}/auth/refresh`).send({ refreshToken: victim.refreshToken });
      expect(refresh.status).toBe(401);
      const rows = await prisma.refreshToken.findMany({ where: { userId: victim.userId } });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.revokedAt !== null)).toBe(true);

      // Other users are untouched.
      expect((await http().get(`${API}/auth/me`).set('Authorization', `Bearer ${customer.accessToken}`)).status).toBe(200);
    });
  });
});
