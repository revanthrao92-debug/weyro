import { Logger } from '@nestjs/common';
import { Prisma, PaymentStatus, PrismaClient } from '@prisma/client';
import type { PaymentGateway } from './interfaces/payment-gateway.interface';

/**
 * STEP 1 — Idempotent settlement primitive.
 *
 * ONE shared claim used by BOTH /payments/verify and the Razorpay webhook,
 * for both booking payments and spare-part orders. Contract:
 *
 *  - conditional UPDATE … WHERE id AND status IN (PENDING, AUTHORIZED)
 *    (PENDING only for spare-part orders, matching their state machine)
 *  - 0 rows updated ⇒ safe no-op (already settled / concurrently claimed)
 *  - caller must do server-side amount binding BEFORE calling
 *  - caller decides notification/audit side effects AFTER commit
 */

export interface PaymentClaimInput {
  /** Payment row id. */
  paymentId: string;
  /** Optional status ceiling guard — the state machine's allowed sources. */
}

export interface SparePartClaimInput {
  orderId: string;
  sparePartId: string;
  quantity: number;
}

export interface SettleResult {
  applied: boolean;
  alreadySettled: boolean;
  /** Row id that was claimed. */
  id: string;
  /** Final stored status after the claim (only when applied = true). */
  status?: string;
  /**
   * The money was captured but the part sold out in the meantime: the order is
   * now CANCELLED and the caller must refund it (refundCancelledSpareOrder).
   */
  outOfStock?: boolean;
}

const logger = new Logger('Settlement');

/**
 * Claim a booking payment to CAPTURED. Idempotent: a second caller (the
 * webhook racing a client verify, or vice versa) sees 0 rows and receives
 * { applied: false, alreadySettled: true } instead of an error.
 */
export async function settleBookingPayment(
  tx: Prisma.TransactionClient,
  input: PaymentClaimInput,
  data: { gatewayPaymentId: string; gatewayOrderId: string },
): Promise<SettleResult> {
  const claimed = await tx.payment.updateMany({
    where: {
      id: input.paymentId,
      status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] as unknown as PaymentStatus[] },
    },
    data: {
      status: 'CAPTURED' as PaymentStatus,
      gatewayPaymentId: data.gatewayPaymentId,
      gatewayOrderId: data.gatewayOrderId,
      paidAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    const settled = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: { status: true },
    });
    const alreadySettled = settled?.status === 'CAPTURED';
    logger.log(
      `Payment ${input.paymentId} claim no-op (alreadySettled=${alreadySettled}, status=${settled?.status ?? 'unknown'})`,
    );
    // A concurrent claim that won is a no-op. A record in a NON-claimable
    // state (REFUNDED etc.) is also a no-op here — the state machine has
    // already handled it and callers must not undo settled money.
    return { applied: false, alreadySettled, id: input.paymentId };
  }

  const row = await tx.payment.findUniqueOrThrow({
    where: { id: input.paymentId },
    select: { id: true, status: true },
  });
  logger.log(`Payment ${input.paymentId} settled to ${row.status}`);
  return { applied: true, alreadySettled: false, id: row.id, status: row.status };
}

/**
 * Claim a spare-part order to PAID with the SAME idempotency contract.
 *
 * Fixes the Step-0 race: the stock decrement now happens only AFTER the
 * conditional claim (0 rows ⇒ no stock change), so a webhook racing the
 * client verify can never double-decrement inventory.
 */
export async function settleSparePartOrderPayment(
  tx: Prisma.TransactionClient,
  input: SparePartClaimInput,
  data: { gatewayPaymentId: string; gatewayOrderId?: string },
): Promise<SettleResult> {
  const claimed = await tx.sparePartOrder.updateMany({
    where: { id: input.orderId, status: { in: ['PENDING', 'FAILED'] } },
    data: {
      status: 'PAID',
      gatewayPaymentId: data.gatewayPaymentId,
      paidAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    const settled = await tx.sparePartOrder.findUnique({
      where: { id: input.orderId },
      select: { status: true },
    });
    const alreadySettled = settled?.status === 'PAID';
    logger.log(
      `Spare part order ${input.orderId} claim no-op (alreadySettled=${alreadySettled}, status=${settled?.status ?? 'deleted/unknown'})`,
    );
    return { applied: false, alreadySettled, id: input.orderId };
  }

  // Stock reservation only after the claim. Packages (kind PACKAGE) have no
  // stock semantics.
  const part = await tx.sparePart.findUnique({
    where: { id: input.sparePartId },
    select: { kind: true },
  });

  if (part?.kind !== 'PACKAGE') {
    // Take the stock only if it is still there (conditional, so two buyers of
    // the last unit cannot both get it).
    const taken = await tx.sparePart.updateMany({
      where: { id: input.sparePartId, stockQuantity: { gte: input.quantity } },
      data: { stockQuantity: { decrement: input.quantity } },
    });

    if (taken.count === 0) {
      // Sold out between checkout and payment. Throwing here used to roll back
      // and fail on every retry, leaving the customer charged with no refund.
      // Cancel instead (keeping gatewayPaymentId so the refund knows the
      // payment) and never count it as a sale (paidAt cleared).
      await tx.sparePartOrder.update({
        where: { id: input.orderId },
        data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED', paidAt: null },
      });
      logger.warn(`Spare part order ${input.orderId} paid but sold out: cancelled for refund`);
      return { applied: false, alreadySettled: false, outOfStock: true, id: input.orderId, status: 'CANCELLED' };
    }
  }

  const row = await tx.sparePartOrder.findUniqueOrThrow({
    where: { id: input.orderId },
    select: { id: true, status: true },
  });
  logger.log(`Spare part order ${input.orderId} settled to ${row.status}`);
  return { applied: true, alreadySettled: false, id: row.id, status: row.status };
}

/**
 * Refund a parts order that was cancelled after its payment was captured
 * (customer cancelled, or it sold out). Safe to call twice: it reuses a refund
 * the gateway already has for this payment and amount, and only moves
 * CANCELLED -> REFUNDED. Never throws: a failed refund is logged for follow-up.
 */
export async function refundCancelledSpareOrder(
  prisma: Pick<PrismaClient, 'sparePartOrder' | 'auditLog'>,
  gateway: Pick<PaymentGateway, 'refundPayment' | 'findRefund'>,
  order: { orderId: string; gatewayPaymentId: string | null | undefined; amount: unknown; reason: string },
): Promise<void> {
  if (!order.gatewayPaymentId) return;
  const amountInPaise = Math.round(Number(order.amount) * 100);
  try {
    const refund =
      (await gateway.findRefund?.(order.gatewayPaymentId, amountInPaise)) ??
      (await gateway.refundPayment({
        paymentId: order.gatewayPaymentId,
        amountInPaise,
        notes: { orderId: order.orderId, reason: order.reason },
      }));

    await prisma.sparePartOrder.updateMany({
      where: { id: order.orderId, status: 'CANCELLED' },
      data: { status: 'REFUNDED' },
    });
    await prisma.auditLog.create({
      data: {
        action: 'payment.auto_refund',
        entityType: 'SparePartOrder',
        entityId: order.orderId,
        newValues: { refundId: refund.refundId, reason: order.reason },
      },
    });
    logger.warn(`Auto-refunded cancelled order ${order.orderId} (${order.reason}, ${refund.refundId})`);
  } catch (error) {
    logger.error(`Auto-refund failed for cancelled order ${order.orderId}: ${(error as Error).message}`);
  }
}
