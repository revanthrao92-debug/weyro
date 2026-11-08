import { Logger } from '@nestjs/common';
import { Prisma, PaymentStatus } from '@prisma/client';

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
      status: { in: ['PENDING', 'AUTHORIZED'] as unknown as PaymentStatus[] },
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
    where: { id: input.orderId, status: 'PENDING' },
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
    const updatedPart = await tx.sparePart.update({
      where: { id: input.sparePartId },
      data: { stockQuantity: { decrement: input.quantity } },
    });

    if (updatedPart.stockQuantity < 0) {
      // Roll the whole transaction back — the claim disappears with it, so
      // callers can retry a different flow. Concurrent settlement already
      // cannot happen (conditional claim won exactly once).
      throw new Error('Insufficient stock to complete this order');
    }
  }

  const row = await tx.sparePartOrder.findUniqueOrThrow({
    where: { id: input.orderId },
    select: { id: true, status: true },
  });
  logger.log(`Spare part order ${input.orderId} settled to ${row.status}`);
  return { applied: true, alreadySettled: false, id: row.id, status: row.status };
}
