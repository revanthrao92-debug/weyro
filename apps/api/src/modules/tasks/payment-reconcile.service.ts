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
      id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
      status?: string;
    }>;
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

      if (stale.length === 0) {
        return;
      }

      this.logger.log(`Reconciling ${stale.length} stale payment(s) (cutoff ${cutoff.toISOString()})`);

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
    // Payments without a gateway order were never opened on Razorpay.
    if (!row.gatewayOrderId) {
      await this.markFailed(row, 'missing gateway order id');
      return;
    }

    let remote: {
      id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
      status?: string;
    };
    try {
      remote = await this.gateway().fetchPayment(row.gatewayOrderId);
    } catch (err: any) {
      // Not found at the gateway = the order was never paid.
      if (isNotFound(err)) {
        await this.markFailed(row, 'order not found on gateway');
        return;
      }
      throw err; // transient network / gateway hiccup — retried next cycle
    }

    switch (remote.status) {
      case 'captured':
      case 'authorized': {
        if (Math.round(Number(row.amount) * 100) !== Number(remote.amount ?? 0)) {
          await this.markFailed(
            row,
            `amount mismatch on reconcile: gateway ${remote.amount} vs local ₹${row.amount}`,
          );
          return;
        }

        const sparePartOrder = row.bookingId
          ? null
          : await this.prisma.sparePartOrder.findUnique({
          where: { id: row.bookingId ?? '' },
          select: { id: true, sparePartId: true, quantity: true, status: true },
        });

        if (sparePartOrder && ['PENDING', 'PAID'].includes(sparePartOrder.status)) {
          const r = await this.prisma.$transaction((tx) =>
            settleSparePartOrderPayment(
              tx,
              {
                orderId: sparePartOrder.id,
                sparePartId: sparePartOrder.sparePartId,
                quantity: sparePartOrder.quantity,
              },
              {
                gatewayPaymentId: remote.id ?? remote.order_id ?? '',
                gatewayOrderId: remote.order_id ?? '',
              },
            ),
          );
          if (r.applied) {
            await this.audit(row.id, row.status, `settled→${remote.status}`);
          }
          return;
        } else {
          const r = await this.prisma.$transaction((tx) =>
            settleBookingPayment(
              tx,
              { paymentId: row.id },
              { gatewayPaymentId: remote.id ?? '', gatewayOrderId: remote.order_id ?? '' },
            ),
          );
          // Only audit when this reconcile actually applied the claim; a
          // lost race (settled by webhook meanwhile) must stay silent.
          if (r.applied) {
            await this.audit(row.id, row.status, `settled→${remote.status}`);
          }
          return;
        }
      }

      case 'failed': {
        await this.markFailed(row, `gateway status ${remote.status}`);
        return;
      }

      default: {
        // 'created' / pending on the gateway — still waiting, no action.
        this.logger.log(`Reconcile ${row.id}: gateway reports ${remote.status} — leaving as-is`);
        break;
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
    paymentId: string,
    from: string,
    outcome: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: ACTION,
        entityType: 'Payment',
        entityId: paymentId,
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
