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

// eslint-disable-next-line import/first
import { AppModule } from '../app.module';
// eslint-disable-next-line import/first
import { PrismaService } from '../prisma/prisma.service';

jest.setTimeout(120_000);

const API = '/api/v1';

interface Session {
  accessToken: string;
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

  const http = () => request(app.getHttpServer());

  const register = async (body: Record<string, unknown>): Promise<Session> => {
    const res = await http().post(`${API}/auth/register`).send(body);

    expect(res.status).toBe(201);
    expect(typeof res.body.accessToken).toBe('string');

    const session: Session = {
      accessToken: res.body.accessToken,
      userId: res.body.user.id,
      profileId:
        res.body.user.customerProfile?.id ?? res.body.user.providerProfile?.id,
    };
    sessions.push(session);
    return session;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    customer = await register({
      email: `e2e-customer-${suffix}@example.com`,
      phone: `+9198${suffix.slice(-8)}`,
      password,
      role: 'CUSTOMER',
      firstName: 'E2E',
      lastName: 'Customer',
    });

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
      const paidNotifications = await prisma.notification.findMany({
        where: { userId: { in: [customer.userId, dealer.userId] } },
      });
      expect(
        paidNotifications.filter(
          (n) => (n.data as any)?.type === 'SPARE_PART_ORDER_PAID',
        ).length,
      ).toBeGreaterThanOrEqual(2);
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
});
