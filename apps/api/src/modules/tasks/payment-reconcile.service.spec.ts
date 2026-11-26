import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PaymentReconcileService } from './payment-reconcile.service';
import { AdvisoryLockService } from '../../prisma/advisory-lock.service';
import type { PaymentGateway } from '../payments/interfaces/payment-gateway.interface';

/**
 * STEP 2 — payment reconciliation tests (Razorpay mocked via the injected
 * gateway). Decision tree: captured → settle · failed → FAILED ·
 * not-found → FAILED · still pending on gateway → no-op · rows claimed
 * concurrently → silent no-op (AuditLog only when this run applied).
 */
describe('PaymentReconcileService', () => {
  let reconcile: PaymentReconcileService;
  let prisma: any;
  let advisoryLock: any;
  let gatewayFetch: jest.Mock;

  function seedRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'pay_rec_1',
      status: 'PENDING',
      amount: 100,
      currency: 'INR',
      gatewayOrderId: 'order_rec_1',
      gatewayPaymentId: 'pay_rec_1',
      bookingId: 'bk_rec_1',
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(null),
        // Read-back after a successful claim (was undefined, so settle crashed
        // and the old error-audit made the "settles" test pass by accident).
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'pay_rec_1', status: 'CAPTURED' }),
        update: jest.fn(),
      },
      sparePartOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'spo_x', status: 'PAID' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      sparePart: {
        findUnique: jest.fn().mockResolvedValue({ kind: 'PART' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    advisoryLock = {
      tryLock: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    };
    gatewayFetch = jest.fn();
    reconcile = new PaymentReconcileService(
      prisma,
      advisoryLock as unknown as AdvisoryLockService,
      { fetchPayment: gatewayFetch } as unknown as PaymentGateway,
    );
  });

  it('acquires the advisory lock before scanning and releases after', async () => {
    prisma.payment.findMany.mockResolvedValue([]);
    await reconcile.reconcile();
    expect(advisoryLock.tryLock).toHaveBeenCalledWith('payment.reconcile');
    expect(advisoryLock.release).toHaveBeenCalledWith('payment.reconcile');
  });

  it('reconciles a payment that only has a gateway order id', async () => {
    prisma.payment.findMany.mockResolvedValue([
      seedRow({ gatewayPaymentId: null, bookingId: 'bk_rec_1' }),
    ]);
    prisma.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay_rec_1',
      status: 'CAPTURED',
    });
    const fetchOrderPayments = jest.fn().mockResolvedValue([
      {
        id: 'pay_order_1',
        order_id: 'order_rec_1',
        amount: 10000,
        currency: 'INR',
        status: 'captured',
      },
    ]);
    reconcile = new PaymentReconcileService(
      prisma,
      advisoryLock as unknown as AdvisoryLockService,
      {
        fetchPayment: gatewayFetch,
        fetchOrderPayments,
      } as unknown as PaymentGateway,
    );

    await reconcile.reconcile();

    expect(fetchOrderPayments).toHaveBeenCalledWith('order_rec_1');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'pay_rec_1' }),
        data: expect.objectContaining({
          status: 'CAPTURED',
          gatewayPaymentId: 'pay_order_1',
        }),
      }),
    );
  });

  it('reconciles a pending spare-part order by order id', async () => {
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.sparePartOrder.findMany = jest.fn().mockResolvedValue([
      {
        id: 'spo_rec_1',
        sparePartId: 'part_1',
        quantity: 1,
        totalAmount: 500,
        currency: 'INR',
        gatewayOrderId: 'order_sp_rec',
      },
    ]);
    prisma.sparePartOrder.findUnique.mockResolvedValue({
      id: 'spo_rec_1',
      sparePartId: 'part_1',
      quantity: 1,
      status: 'PENDING',
    });
    const fetchOrderPayments = jest.fn().mockResolvedValue([
      {
        id: 'pay_sp_1',
        order_id: 'order_sp_rec',
        amount: 50000,
        currency: 'INR',
        status: 'captured',
      },
    ]);
    reconcile = new PaymentReconcileService(
      prisma,
      advisoryLock as unknown as AdvisoryLockService,
      {
        fetchPayment: gatewayFetch,
        fetchOrderPayments,
      } as unknown as PaymentGateway,
    );

    await reconcile.reconcile();

    expect(prisma.sparePartOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'spo_rec_1', status: { in: ['PENDING', 'FAILED'] } },
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
  });

  it('returns early when another instance holds the lock', async () => {
    advisoryLock.tryLock.mockResolvedValue(false);
    await reconcile.reconcile();
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when there are no stale payments', async () => {
    await reconcile.reconcile();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('settles CAPTURED gateway rows and writes an AuditLog entry', async () => {
    prisma.payment.findMany.mockResolvedValue([seedRow()]);
    gatewayFetch.mockResolvedValue({
      id: 'pay_rzp_1',
      order_id: 'order_rec_1',
      amount: 10000,
      currency: 'INR',
      status: 'captured',
    });

    await reconcile.reconcile();

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_rec_1', status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] } },
        data: expect.objectContaining({ status: 'CAPTURED' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'payment.reconcile',
          entityId: 'pay_rec_1',
        }),
      }),
    );
  });

  it('marks rows FAILED when the gateway reports the order failed', async () => {
    prisma.payment.findMany.mockResolvedValue([seedRow()]);
    gatewayFetch.mockResolvedValue({
      id: 'pay_gw_probe',
      order_id: 'order_rec_1',
      amount: 10000,
      currency: 'INR',
      status: 'failed',
    });

    await reconcile.reconcile();

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_rec_1', status: { in: ['PENDING', 'AUTHORIZED'] } },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'payment.reconcile',
          newValues: expect.objectContaining({ outcome: 'failed' }),
        }),
      }),
    );
  });

  it('leaves rows untouched when no gateway payment id exists', async () => {
    prisma.payment.findMany.mockResolvedValue([
      seedRow({ gatewayPaymentId: null }),
    ]);

    await reconcile.reconcile();

    expect(gatewayFetch).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: expect.anything() }) }),
    );
    // Not settled: moved to the back of the queue so other rows get a turn.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay_rec_1', status: { in: ['PENDING', 'AUTHORIZED'] } },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('marks FAILED when the gateway cannot find the payment', async () => {
    prisma.payment.findMany.mockResolvedValue([seedRow()]);
    gatewayFetch.mockRejectedValue({ statusCode: 404, message: 'payment not found' });

    await reconcile.reconcile();

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_rec_1', status: { in: ['PENDING', 'AUTHORIZED'] } },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('marks FAILED on Razorpay\'s real "id does not exist" reply (400, after gateway normalization)', async () => {
    prisma.payment.findMany.mockResolvedValue([seedRow()]);
    gatewayFetch.mockRejectedValue(
      Object.assign(new Error('The id provided does not exist'), {
        statusCode: 400,
        code: 'BAD_REQUEST_ERROR',
      }),
    );

    await reconcile.reconcile();

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('leaves rows as-is when the gateway says still pending on its side', async () => {
    prisma.payment.findMany.mockResolvedValue([seedRow()]);
    gatewayFetch.mockResolvedValue({
      id: 'pay_gw_pending',
      order_id: 'order_rec_1',
      amount: 10000,
      currency: 'INR',
      status: 'created',
    });

    await reconcile.reconcile();

    expect(prisma.payment.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: expect.anything() }) }),
    );
    // Not settled: moved to the back of the queue so other rows get a turn.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay_rec_1', status: { in: ['PENDING', 'AUTHORIZED'] } },
      data: { updatedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('no-ops (no AuditLog) when the row was claimed concurrently', async () => {
    prisma.payment.findMany.mockResolvedValue([seedRow()]);
    gatewayFetch.mockResolvedValue({
      id: 'pay_gw_captured',
      order_id: 'order_rec_1',
      amount: 10000,
      currency: 'INR',
      status: 'captured',
    });
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay_rec_1', status: 'CAPTURED' });

    await reconcile.reconcile();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('only picks rows where the customer started paying, so unpaid bookings cannot fill every batch', async () => {
    await reconcile.reconcile();
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ gatewayOrderId: { not: null } }) }),
    );
  });

  it('an erroring row is logged and retried later, without an audit row every minute', async () => {
    prisma.payment.findMany.mockResolvedValue([seedRow()]);
    gatewayFetch.mockResolvedValue({ id: 'pay_rzp_1', order_id: 'order_rec_1', amount: 1, currency: 'INR', status: 'captured' }); // amount mismatch
    await reconcile.reconcile();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { updatedAt: expect.any(Date) } }),
    );
  });

  it('unpaid parts checkouts rotate too, and ones older than a week stop being checked', async () => {
    prisma.sparePartOrder.findMany.mockResolvedValue([
      { id: 'spo_1', sparePartId: 'p1', quantity: 1, totalAmount: 749, currency: 'INR', gatewayOrderId: 'order_sp' },
    ]);
    const withOrderPayments = new PaymentReconcileService(
      prisma,
      advisoryLock as unknown as AdvisoryLockService,
      { fetchPayment: gatewayFetch, fetchOrderPayments: jest.fn().mockResolvedValue([]) } as unknown as PaymentGateway,
    );
    await withOrderPayments.reconcile();
    const where = prisma.sparePartOrder.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gt.getTime()).toBeGreaterThan(Date.now() - 7 * 86_400_000 - 5000);
    expect(prisma.sparePartOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'spo_1', status: 'PENDING' },
      data: { updatedAt: expect.any(Date) },
    });
  });
});
