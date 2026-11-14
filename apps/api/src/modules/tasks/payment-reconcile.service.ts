import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { env } from '../../config/env.config';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvisoryLockService } from '../../prisma/advisory-lock.service';
import { settleBookingPayment, settleSparePartOrderPayment } from '../payments/settle-payment';
import {
  PaymentGateway,
  PAYMENT_GATEWAY,
} from '../payments/interfaces/payment-gateway.interface';

/**
 * STEP 2 — Payment reconciliation.
 *
 * Every `PAYMENT_RECONCILE_INTERVAL`-minute window: scan payments stuck in
 * PENDING/AUTHORIZED beyond `PAYMENT_RECONCILE_WINDOW` (default 15 min),
 * ask Razorpay for the truth, and converge local state:
 *
 *   captured/authorized → settleBookingPayment (idempotent claim) — for
 *      booking payments; spare-part orders settle to PAID w/ stock claim.
 *   failed/refunded/error → mark FAILED (FAILED never overwritten later).
 *   not found at gateway (never actually opened) → mark FAILED.
 *
 * Every action is logged and appended to the AuditLog. Gated by an
 * advisory lock (Step 3) so replicas never reconcile concurrently.
 */

const ACTION = 'payment.reconcile';

@Injectable()
export class PaymentReconcileService {
  private readonly logger = new Logger(PaymentReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly advisoryLock: AdvisoryLockService,
    // Gateway is optional so tests can run with mock rows.
    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway?: PaymentGateway,
  ) {}

  private gateway(): {
    fetchPayment: (id: string) => Promise<{
      id: string;
      order_id: string;
      amount: number;
      currency: string;
      status: string;
    }>;
    fetchOrderPayments?: (orderId: string) => Promise<
      {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
      }[]
    >;
  } {
    if (!this.paymentGateway) {
      throw new Error('Reconciliation requires a configured PaymentGateway');
    }
    return this.paymentGateway;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcile(): Promise<void> {
    const windowMinutes = Number(env.PAYMENT_RECONCILE_WINDOW_MINUTES ?? 15);
    const batchSize = Number(env.PAYMENT_RECONCILE_BATCH ?? 25);
    const cutoff = new Date(Date.now() - windowMinutes * 60_000);

    if (!(await this.advisoryLock.tryLock(ACTION))) {
      this.logger.log('Reconciliation already running on another instance — skipping.');
      return;
    }

    try {
      const stale = await this.prisma.payment.findMany({
        where: {
          status: { in: ['PENDING', 'AUTHORIZED'] as never },
          updatedAt: { lt: cutoff },
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          gatewayOrderId: true,
          gatewayPaymentId: true,
          bookingId: true,
        },
      });

      if (stale.length > 0) {
        this.logger.log(
          `Reconciling ${stale.length} stale payment(s) (cutoff ${cutoff.toISOString()})`,
        );
      }

      for (const row of stale) {
        try {
          await this.reconcileOne(row);
        } catch (err: any) {
          this.logger.error(
            `Reconciliation for payment ${row.id} errored: ${err?.message ?? err}`,
          );
          await this.audit(row.id, row.status, 'error', err?.message);
        }
      }

      await this.reconcileSparePartOrders(cutoff, batchSize);
    } finally {
      await this.advisoryLock.release(ACTION);
    }
  }

  private async reconcileOne(
    row: {
      id: string;
      status: string;
      amount: unknown;
      currency: unknown;
      gatewayOrderId: string | null;
      gatewayPaymentId: string | null;
      bookingId: string | null;
    },
  ): Promise<void> {
    const remote = await this.resolveRemotePayment(
      row.gatewayPaymentId,
      row.gatewayOrderId,
      Math.round(Number(row.amount) * 100),
      String(row.currency),
    );

    if (!remote) {
      if (row.gatewayPaymentId) {
        await this.markFailed(row, 'payment not found on gateway');
        return;
      }
      // No payment attempt exists yet. Leave the row for the client verify or
      // a later webhook rather than guessing.
      return;
    }

    switch (remote.status) {
      case 'captured':
      case 'authorized': {
        const r = await this.prisma.$transaction((tx) =>
          settleBookingPayment(
            tx,
            { paymentId: row.id },
            {
              gatewayPaymentId: remote.id,
              gatewayOrderId: remote.order_id,
            },
          ),
        );
        if (r.applied) {
          await this.audit(row.id, row.status, `settled→${remote.status}`);
        }
        return;
      }

      case 'failed': {
        await this.markFailed(row, `gateway status ${remote.status}`);
        return;
      }

      default: {
        this.logger.log(
          `Reconcile ${row.id}: gateway reports ${remote.status} — leaving as-is`,
        );
        break;
      }
    }
  }

  /**
   * Find the authoritative payment for a local row. Uses payment id when
   * present, otherwise scans the order's payment attempts (the case that was
   * previously unreachable: webhook lost and client never verified).
   */
  private async resolveRemotePayment(
    paymentId: string | null,
    orderId: string | null,
    expectedMinor: number,
    expectedCurrency: string,
  ): Promise<{
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  } | null> {
    if (paymentId) {
      try {
        const payment = await this.gateway().fetchPayment(paymentId);
        if (
          Number(payment.amount) !== expectedMinor ||
          payment.currency !== expectedCurrency
        ) {
          throw new Error(
            `amount/currency mismatch: gateway ${payment.amount} ${payment.currency} vs local ${expectedMinor} ${expectedCurrency}`,
          );
        }
        return { ...payment, id: payment.id, order_id: payment.order_id };
      } catch (err: any) {
        if (isNotFound(err)) return null;
        throw err;
      }
    }

    if (!orderId) return null;
    const fetchOrderPayments = this.gateway().fetchOrderPayments;
    if (!fetchOrderPayments) return null;

    const payments = await fetchOrderPayments.call(this.gateway(), orderId);
    const matching = payments
      .filter(
        (payment) =>
          Number(payment.amount) === expectedMinor &&
          payment.currency === expectedCurrency,
      )
      .sort((a, b) => {
        const rank = (status: string) =>
          status === 'captured' ? 0 : status === 'authorized' ? 1 : 2;
        return rank(a.status) - rank(b.status);
      });
    return matching[0] ?? null;
  }

  private async reconcileSparePartOrders(
    cutoff: Date,
    batchSize: number,
  ): Promise<void> {
    const fetchOrderPayments = this.gateway().fetchOrderPayments;
    if (!fetchOrderPayments) return;

    const stale = await this.prisma.sparePartOrder.findMany({
      where: {
        status: 'PENDING',
        gatewayOrderId: { not: null },
        updatedAt: { lt: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      select: {
        id: true,
        sparePartId: true,
        quantity: true,
        totalAmount: true,
        currency: true,
        gatewayOrderId: true,
      },
    });

    for (const order of stale) {
      try {
        const payments = await fetchOrderPayments.call(
          this.gateway(),
          order.gatewayOrderId as string,
        );
        const expected = Math.round(Number(order.totalAmount) * 100);
        const captured = payments.find(
          (payment) =>
            payment.status === 'captured' &&
            Number(payment.amount) === expected &&
            payment.currency === order.currency,
        );
        if (!captured) continue;

        const settled = await this.prisma.$transaction((tx) =>
          settleSparePartOrderPayment(
            tx,
            {
              orderId: order.id,
              sparePartId: order.sparePartId,
              quantity: order.quantity,
            },
            {
              gatewayPaymentId: captured.id,
              gatewayOrderId: order.gatewayOrderId as string,
            },
          ),
        );
        if (settled.applied) {
          await this.audit(
            order.id,
            'PENDING',
            'settled→captured',
            undefined,
            'SparePartOrder',
          );
        }
      } catch (err: any) {
        this.logger.error(
          `Reconciliation for spare-part order ${order.id} errored: ${err?.message ?? err}`,
        );
      }
    }
  }

  private async markFailed(row: { id: string; status: string }, reason: string): Promise<void> {
    const claimed = await this.prisma.payment.updateMany({
      where: { id: row.id, status: { in: ['PENDING', 'AUTHORIZED'] as never } },
      data: { status: 'FAILED' as never },
    });

    if (claimed.count === 0) {
      this.logger.log(`Reconcile ${row.id}: transitioned concurrently — skip FAILED`);
      return;
    }
    this.logger.warn(`Reconcile ${row.id}: marked FAILED (${reason})`);
    await this.audit(row.id, row.status, 'failed', reason);
  }

  private async audit(
    entityId: string,
    from: string,
    outcome: string,
    reason?: string,
    entityType = 'Payment',
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: ACTION,
        entityType,
        entityId,
        newValues: { from, outcome, reason },
      },
    });
  }


}

function isNotFound(err: any): boolean {
  const code = err?.statusCode ?? err?.code;
  return (
    typeof code !== 'undefined' &&
    (code === 404 || code === '404' || /not (found|exist)|order.id/i.test(String(err?.message ?? '')))
  );
}
