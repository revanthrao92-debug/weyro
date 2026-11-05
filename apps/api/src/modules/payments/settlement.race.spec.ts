import { PaymentsService } from './payments.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import type { PaymentGateway } from './interfaces/payment-gateway.interface';

/**
 * STEP 1 — settlement race matrix across verify ↔ webhook.
 * BOTH arrival orders × both entity kinds (booking payment + spare-part
 * order), plus wrong-amount and duplicate-event-id guards.
 */

const remote = {
  id: 'pay_rzp_c',
  order_id: 'order_wb',
  amount: 10000, // paise → ₹100
  currency: 'INR',
  status: 'captured',
};

type Harness = {
  payments: PaymentsService;
  parts: SparePartsService;
  prisma: any;
  gateway: any;
};

function makeHarness(): Harness {
  const prisma: any = {
    payment: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'pay_1', status: 'CAPTURED' }),
      findFirst: jest.fn(),
    },
    sparePartOrder: {
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'spo_1', status: 'PAID' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    sparePart: {
      findUnique: jest.fn().mockResolvedValue({ kind: 'PART' }),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ stockQuantity: 99 }),
    },
    webhookEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    booking: { findUnique: jest.fn().mockResolvedValue(null) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'usr_c' }) },
    providerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'usr_p' }) },
    auditLog: { create: jest.fn() },
    quotation: { findUnique: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(prisma)),
  };

  const gateway: any = {
    verifyPaymentSignature: jest.fn().mockReturnValue(true),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    createOrder: jest.fn(),
    refundPayment: jest.fn(),
    fetchPayment: jest.fn().mockResolvedValue({ ...remote }),
  };

  const notifications: any = { sendPushNotification: jest.fn().mockResolvedValue({}) };
  const outbox: any = { enqueue: jest.fn().mockResolvedValue('obx') };
  return {
    payments: new PaymentsService(prisma, gateway, notifications),
    parts: new SparePartsService(prisma, gateway as unknown as PaymentGateway, notifications, outbox),
    outbox,
    prisma,
    gateway,
  };
}

const customerUser = {
  sub: 'usr_c',
  role: 'CUSTOMER',
  customerProfileId: 'cust_1',
} as never;

/** Booking row whose payment status follows a mutable flag. */
function bookingRow(status: string) {
  return {
    id: 'bk_1',
    customerId: 'cust_1',
    payments: [
      { id: 'pay_1', status, amount: 100, currency: 'INR', gatewayOrderId: 'order_wb' },
    ],
  };
}

/** Payment row view whose status follows a mutable flag. */
function paymentRow(status: string) {
  return {
    id: 'pay_1',
    status,
    amount: 100,
    currency: 'INR',
    gatewayOrderId: 'order_wb',
  };
}

const webhookPayload = () => ({
  id: 'evt_race',
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_rzp_c',
        order_id: 'order_wb',
        amount: 10000,
        currency: 'INR',
      },
    },
  },
});

describe('STEP 1 — race matrix (booking payments)', () => {
  it('verify-then-webhook: webhook lands on an already-CAPTURED payment as a no-op', async () => {
    const h = makeHarness();
    let captured = false;
    h.prisma.booking.findUnique.mockImplementation(async () => bookingRow(captured ? 'CAPTURED' : 'PENDING'));
    h.prisma.payment.findUnique.mockImplementation(async () => paymentRow(captured ? 'CAPTURED' : 'PENDING'));
    h.prisma.payment.updateMany.mockImplementation(async () => {
      captured = true;
      return { count: 1 };
    });

    await h.payments.verifyPayment(
      { bookingId: 'bk_1', orderId: 'order_wb', paymentId: 'pay_rzp_c', signature: 'x' },
      customerUser,
    );
    const res = await h.payments.handleWebhook('raw', 'sig', webhookPayload());

    expect(res.status).toBe('processed'); // capture branch skipped: settled
    expect(h.prisma.payment.updateMany).toHaveBeenCalledTimes(1);
  });

  it('webhook-then-verify: client verify lands on an already-CAPTURED payment as a no-op', async () => {
    const h = makeHarness();
    let captured = false;
    h.prisma.booking.findUnique.mockImplementation(async () => bookingRow(captured ? 'CAPTURED' : 'PENDING'));
    h.prisma.payment.findUnique.mockImplementation(async () => paymentRow(captured ? 'CAPTURED' : 'PENDING'));
    h.prisma.payment.updateMany.mockImplementation(async () => {
      captured = true;
      return { count: 1 };
    });

    await h.payments.handleWebhook('raw', 'sig', webhookPayload());

    const res = await h.payments.verifyPayment(
      { bookingId: 'bk_1', orderId: 'order_wb', paymentId: 'pay_rzp_c', signature: 'x' },
      customerUser,
    );
    expect(res.status).toBe('ALREADY_CAPTURED');
    expect(h.prisma.payment.updateMany).toHaveBeenCalledTimes(1);
  });

  it('concurrent double-delivery: only ONE of the two claims wins (0 rows = no-op)', async () => {
    const h = makeHarness();
    let claims = 0;
    h.prisma.booking.findUnique.mockImplementation(async () => bookingRow('PENDING'));
    h.prisma.payment.findUnique.mockImplementation(async () => paymentRow('PENDING'));
    h.prisma.$transaction.mockImplementation(async (cb: any) => {
      claims += 1;
      const winner = claims === 1;
      return cb({
        ...h.prisma,
        payment: {
          ...h.prisma.payment,
          updateMany: jest
            .fn()
            .mockResolvedValue(winner ? { count: 1 } : { count: 0 }),
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 'pay_1', status: 'CAPTURED' }),
        },
      });
    });

    await h.payments.verifyPayment(
      { bookingId: 'bk_1', orderId: 'order_wb', paymentId: 'pay_rzp_c', signature: 'x' },
      customerUser,
    );
    const res = await h.payments.verifyPayment(
      { bookingId: 'bk_1', orderId: 'order_wb', paymentId: 'pay_rzp_c', signature: 'x' },
      customerUser,
    );

    expect(['IDEMPOTENT_NOOP', 'ALREADY_CAPTURED']).toContain(res.status);
    expect(claims).toBe(2);
  });

  it('duplicate event id is dropped before any claim (webhook idempotency row)', async () => {
    const h = makeHarness();
    h.prisma.booking.findUnique.mockImplementation(async () => bookingRow('PENDING'));
    h.prisma.payment.findUnique.mockImplementation(async () => paymentRow('PENDING'));
    h.prisma.webhookEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'evt_race', eventId: 'evt_race' });

    const res1 = await h.payments.handleWebhook('raw', 'sig', webhookPayload());
    const res2 = await h.payments.handleWebhook('raw', 'sig', webhookPayload());

    expect([res1.status, res2.status]).toEqual(['processed', 'ignored']);
    expect(h.prisma.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(h.prisma.webhookEvent.create).toHaveBeenCalledTimes(1);
  });
});

describe('STEP 1 — race matrix (spare-part orders)', () => {
  function spareSeed(status: string, kind = 'PART') {
    return {
      id: 'spo_1',
      sparePartId: 'part_1',
      quantity: 2,
      status,
      customerId: 'cust_1',
      providerId: 'prov_1',
      totalAmount: 100,
      currency: 'INR',
      gatewayOrderId: 'order_wb',
      sparePart: { name: 'Clutch kit', kind },
      customer: { userId: 'usr_c' },
      provider: { userId: 'usr_p' },
    };
  }

  it('verify-then-webhook: webhook settles nothing twice (stock decremented once)', async () => {
    const h = makeHarness();
    h.prisma.payment.findUnique.mockResolvedValue(null); // gateway order not owned by a booking payment

    let status = 'PENDING';
    h.prisma.sparePartOrder.findUnique.mockImplementation(async () => spareSeed(status));
    h.prisma.sparePartOrder.updateMany.mockImplementation(async () => {
      status = 'PAID';
      return { count: 1 };
    });

    await h.parts.verifyOrderPayment('spo_1', 'cust_1', {
      razorpayOrderId: 'order_wb',
      razorpayPaymentId: 'pay_rzp_c',
      razorpaySignature: 'sig',
    });
    await h.payments.handleWebhook('raw', 'sig', webhookPayload());

    expect(h.prisma.sparePartOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(h.prisma.sparePart.update).toHaveBeenCalledTimes(1); // ONE decrement
  });

  it('webhook-then-verify: verify settles nothing twice', async () => {
    const h = makeHarness();
    h.prisma.payment.findUnique.mockResolvedValue(null);

    let status = 'PENDING';
    h.prisma.sparePartOrder.findUnique.mockImplementation(async () => spareSeed(status));
    h.prisma.sparePartOrder.updateMany.mockImplementation(async () => {
      status = 'PAID';
      return { count: 1 };
    });

    await h.payments.handleWebhook('raw', 'sig', webhookPayload());
    await h.parts.verifyOrderPayment('spo_1', 'cust_1', {
      razorpayOrderId: 'order_wb',
      razorpayPaymentId: 'pay_rzp_c',
      razorpaySignature: 'sig',
    });

    expect(h.prisma.sparePartOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(h.prisma.sparePart.update).toHaveBeenCalledTimes(1);
  });

  it('wrong amount on webhook is rejected before any claim (order stays untouched)', async () => {
    const h = makeHarness();
    h.prisma.payment.findUnique.mockResolvedValue(null);
    h.prisma.sparePartOrder.findUnique.mockResolvedValue(spareSeed('PENDING'));

    const bad = webhookPayload();
    (bad.payload.payment.entity as Record<string, unknown>).amount = 5;

    await expect(h.payments.handleWebhook('raw', 'sig', bad)).rejects.toThrow(
      /amount or currency/i,
    );
    expect(h.prisma.sparePartOrder.updateMany).not.toHaveBeenCalled();
  });
});
