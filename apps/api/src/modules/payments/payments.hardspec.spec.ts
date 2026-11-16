import { BadRequestException, ConflictException } from '@nestjs/common';
import { env } from '../../config/env.config';
import { PaymentsService } from './payments.service';
import { RazorpayPaymentGateway } from './gateways/razorpay.gateway';
import { GatewayPaymentInfo } from './interfaces/payment-gateway.interface';

/**
 * H1/H2/H3/M4 remediation tests:
 *  - client-verify binds amount/currency/order to the authoritative gateway fetch
 *  - capture + release state transitions are conditionally claimed inside transactions
 *  - webhook verification fails hard without an independent secret in production
 */

const basePaymentRecord = {
  id: 'pay-1',
  status: 'PENDING',
  amount: 100, // rupees
  currency: 'INR',
  gatewayOrderId: 'order_abc',
};

function makeService(remoteOverride: Partial<GatewayPaymentInfo> = {}) {
  const mockPrisma: any = {
    payment: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    webhookEvent: { findUnique: jest.fn(), create: jest.fn() },
    booking: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    payment: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const remote: GatewayPaymentInfo = {
    id: 'pay_rzp_1',
    order_id: 'order_abc',
    amount: 10000, // paise for ₹100
    currency: 'INR',
    status: 'captured',
    ...remoteOverride,
  };

  const mockGateway: any = {
    verifyPaymentSignature: jest.fn().mockReturnValue(true),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    createOrder: jest.fn(),
    refundPayment: jest.fn(),
    supportsServerBinding: jest.fn().mockReturnValue(true),
    fetchPayment: jest.fn().mockResolvedValue(remote),
    // M4: capturing an authorized payment returns it as captured.
    capturePayment: jest.fn().mockImplementation(async () => ({ ...remote, status: 'captured' })),
  };

  const service = new PaymentsService(mockPrisma, mockGateway, {
    sendPushNotification: jest.fn().mockResolvedValue({}),
  } as any);

  const customerUser = {
    sub: 'usr_1',
    role: 'CUSTOMER',
    customerProfileId: 'cust_1',
  } as never;

  const bookingFixture = {
    id: 'bk_1',
    customerId: 'cust_1',
    status: 'COMPLETED',
    payments: [basePaymentRecord],
  };

  // Helper: seed the booking lookup used by verifyPayment/releasePayment
  const seedBooking = (booking?: unknown) =>
    (mockPrisma.booking.findUnique as jest.Mock).mockResolvedValue(
      booking ?? bookingFixture,
    );

  return { service, mockPrisma, mockGateway, customerUser, seedBooking, remote };
}

describe('H2 – client verify binds amount/currency/order to the gateway record', () => {
  it('M4: an authorized payment is captured server-side for the expected amount, then settled', async () => {
    const { service, mockPrisma, mockGateway, customerUser, seedBooking, remote } = makeService({
      status: 'authorized',
    });
    seedBooking();
    // The claim reads back the settled row; give it the CAPTURED state.
    mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      status: 'CAPTURED',
    });

    const res = await service.verifyPayment(
      { bookingId: 'bk_1', orderId: 'order_abc', paymentId: 'pay_rzp_1', signature: 'x' },
      customerUser,
    );
    expect(res.status).toBe('CAPTURED');
    // The capture is for the SERVER's amount (₹100 = 10000 paise), never the client's.
    expect(mockGateway.capturePayment).toHaveBeenCalledWith('pay_rzp_1', 10000, 'INR');
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1', status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] } },
      }),
    );
    // Capture happens BEFORE settlement.
    expect(
      (mockGateway.capturePayment as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan((mockPrisma.payment.updateMany as jest.Mock).mock.invocationCallOrder[0]);
    expect(remote.status).toBe('authorized'); // param sanity
  });

  it('M4: settles nothing when capturing the authorized payment fails', async () => {
    const { service, mockPrisma, mockGateway, customerUser, seedBooking } = makeService({
      status: 'authorized',
    });
    seedBooking();
    mockGateway.capturePayment.mockRejectedValue(new Error('BAD_REQUEST_ERROR: already captured elsewhere'));

    await expect(
      service.verifyPayment(
        { bookingId: 'bk_1', orderId: 'order_abc', paymentId: 'pay_rzp_1', signature: 'x' },
        customerUser,
      ),
    ).rejects.toThrow(/Unable to capture the authorized payment/);
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('M4: settles nothing if the gateway still does not report captured after the capture call', async () => {
    const { service, mockPrisma, mockGateway, customerUser, seedBooking, remote } = makeService({
      status: 'authorized',
    });
    seedBooking();
    mockGateway.capturePayment.mockResolvedValue({ ...remote, status: 'authorized' });

    await expect(
      service.verifyPayment(
        { bookingId: 'bk_1', orderId: 'order_abc', paymentId: 'pay_rzp_1', signature: 'x' },
        customerUser,
      ),
    ).rejects.toThrow(/not captured/);
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('M4: an already captured payment is not captured again', async () => {
    const { service, mockPrisma, mockGateway, customerUser, seedBooking } = makeService({
      status: 'captured',
    });
    seedBooking();
    mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'pay-1', status: 'CAPTURED' });

    await service.verifyPayment(
      { bookingId: 'bk_1', orderId: 'order_abc', paymentId: 'pay_rzp_1', signature: 'x' },
      customerUser,
    );
    expect(mockGateway.capturePayment).not.toHaveBeenCalled();
  });

  it('rejects when the gateway amount does not match the local record (tampered amount)', async () => {
    const { service, customerUser, seedBooking } = makeService({ amount: 1 });
    seedBooking();

    await expect(
      service.verifyPayment(
        { bookingId: 'bk_1', orderId: 'order_abc', paymentId: 'pay_rzp_1', signature: 'x' },
        customerUser,
      ),
    ).rejects.toThrow(
      'Gateway payment amount or order does not match this record',
    );
  });

  it('rejects when the gateway payment belongs to a different order', async () => {
    const { service, customerUser, seedBooking } = makeService({
      order_id: 'order_evil',
    });
    seedBooking();

    await expect(
      service.verifyPayment(
        { bookingId: 'bk_1', orderId: 'order_abc', paymentId: 'pay_rzp_1', signature: 'x' },
        customerUser,
      ),
    ).rejects.toThrow('Gateway payment amount or order does not match this record');
  });

  it('rejects when the gateway reports the payment as failed', async () => {
    const { service, customerUser, seedBooking } = makeService({ status: 'failed' });
    seedBooking();

    await expect(
      service.verifyPayment(
        { bookingId: 'bk_1', orderId: 'order_abc', paymentId: 'pay_rzp_1', signature: 'x' },
        customerUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('H3 – conditional state transitions inside transactions', () => {
  it('treats lost concurrent double-capture as a safe no-op (IDEMPOTENT_NOOP)', async () => {
    const { service, mockPrisma, customerUser, seedBooking } = makeService();
    seedBooking();
    // Another concurrent flow already claimed the capture (webhook won).
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'CAPTURED',
    });
    mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      status: 'CAPTURED',
    });

    const res = await service.verifyPayment(
      { bookingId: 'bk_1', orderId: 'order_abc', paymentId: 'pay_rzp_1', signature: 'x' },
      customerUser,
    );

    expect(res.status).toBe('ALREADY_CAPTURED');
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledTimes(1);
  });

  it('release only claims from CAPTURED (double-release impossible)', async () => {
    const { service, mockPrisma, seedBooking } = makeService();
    seedBooking({
      id: 'bk_1',
      customerId: 'cust_1',
      status: 'COMPLETED',
      payments: [{ ...basePaymentRecord, status: 'CAPTURED' }],
    });

    const admin = { sub: 'admin-1', role: 'ADMIN' } as never;
    const res = await service.releasePayment(
      { bookingId: 'bk_1', payoutReference: 'payout_1' } as never,
      admin,
    );

    expect(res.status).toBe('RELEASED');
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: 'CAPTURED' },
      data: expect.objectContaining({ status: 'RELEASED' }),
    });
  });

  it('release rejects when a concurrent flow already moved it out of CAPTURED', async () => {
    const { service, mockPrisma, seedBooking } = makeService();
    seedBooking({
      id: 'bk_1',
      customerId: 'cust_1',
      status: 'COMPLETED',
      payments: [{ ...basePaymentRecord, status: 'CAPTURED' }],
    } as never);
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });

    const admin = { sub: 'admin-1', role: 'ADMIN' } as never;
    await expect(
      service.releasePayment(
        { bookingId: 'bk_1', payoutReference: 'payout_1' } as never,
        admin,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('release idempotent for an already-released payment', async () => {
    const { service, seedBooking } = makeService();
    seedBooking({
      id: 'bk_1',
      customerId: 'cust_1',
      status: 'COMPLETED',
      payments: [
        { ...basePaymentRecord, status: 'RELEASED', payoutReference: 'payout_0' },
      ],
    } as never);

    const admin = { sub: 'admin-1', role: 'ADMIN' } as never;
    const res = await service.releasePayment(
      { bookingId: 'bk_1', payoutReference: 'payout_1' } as never,
      admin,
    );
    expect(res.status).toBe('ALREADY_RELEASED');
  });
});

describe('H1/M4 – webhook secret & raw body hard fail', () => {
  // The gateway reads the import-time parsed `env` before process.env, so the
  // tests must override that object (and restore it) to be independent of
  // whatever RAZORPAY_* variables the test runner exports.
  const withEnv = (overrides: Record<string, string | undefined>, run: () => void) => {
    const target = env as unknown as Record<string, string | undefined>;
    const previousNodeEnv = process.env.NODE_ENV;
    const previous = Object.fromEntries(Object.keys(overrides).map((k) => [k, target[k]]));
    const previousProcess = Object.fromEntries(
      Object.keys(overrides).map((k) => [k, process.env[k]]),
    );
    process.env.NODE_ENV = 'production';
    for (const [k, v] of Object.entries(overrides)) {
      target[k] = v;
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      run();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      for (const [k, v] of Object.entries(previous)) target[k] = v;
      for (const [k, v] of Object.entries(previousProcess)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };

  it('gateway constructor refuses webhook secret fallback to API secret in production', () => {
    withEnv(
      {
        RAZORPAY_KEY_ID: 'rzp_live_k1',
        RAZORPAY_KEY_SECRET: 'ks_super_secret_value_1',
        RAZORPAY_WEBHOOK_SECRET: 'ks_super_secret_value_1', // same as API secret
      },
      () => {
        expect(() => new RazorpayPaymentGateway()).toThrow(/independent, non-placeholder value/);
      },
    );
  });

  it('gateway constructor refuses unset webhook secret in production', () => {
    withEnv(
      {
        RAZORPAY_KEY_ID: 'rzp_live_k1',
        RAZORPAY_KEY_SECRET: 'ks_super_secret_value_1',
        RAZORPAY_WEBHOOK_SECRET: undefined,
      },
      () => {
        expect(() => new RazorpayPaymentGateway()).toThrow(/independent, non-placeholder value/);
      },
    );
  });
});
