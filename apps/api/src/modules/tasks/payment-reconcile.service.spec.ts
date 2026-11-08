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
      gatewayPaymentId: null,
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
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      sparePartOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'spo_x', status: 'PAID' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      sparePart: {
        findUnique: jest.fn().mockResolvedValue({ kind: 'PART' }),
        update: jest.fn(),
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
        where: { id: 'pay_rec_1', status: { in: ['PENDING', 'AUTHORIZED'] } },
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

  it('marks FAILED when the gateway cannot find the order (never opened)', async () => {
    prisma.payment.findMany.mockResolvedValue([seedRow()]);
    gatewayFetch.mockRejectedValue({ statusCode: 404, message: 'order_id not found' });

    await reconcile.reconcile();

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_rec_1', status: { in: ['PENDING', 'AUTHORIZED'] } },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
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

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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
});
