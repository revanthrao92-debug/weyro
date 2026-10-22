import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface SparePartOrderToSettle {
  id: string;
  sparePartId: string;
  quantity: number;
  status: string;
}

/**
 * Applies a successful payment to a spare-part order exactly once.
 *
 * Shared by the client-side verify endpoint and the Razorpay webhook so the
 * two paths cannot diverge on stock semantics:
 * - parts atomically decrement stock (and fail if sold out meanwhile)
 * - packages are bookable services and never touch stock
 */
export async function settleSparePartOrder(
  tx: Prisma.TransactionClient,
  order: SparePartOrderToSettle,
  gatewayPaymentId?: string,
  gatewayOrderId?: string,
): Promise<{ orderId: string; status: string }> {
  if (order.status === 'PAID') {
    return { orderId: order.id, status: 'ALREADY_PAID' };
  }

  if (order.status !== 'PENDING') {
    throw new ConflictException('Order is no longer payable');
  }

  const part = await tx.sparePart.findUnique({
    where: { id: order.sparePartId },
    select: { kind: true },
  });

  // Packages have no stock semantics; parts atomically reserve stock
  if (part?.kind !== 'PACKAGE') {
    const updatedPart = await tx.sparePart.update({
      where: { id: order.sparePartId },
      data: { stockQuantity: { decrement: order.quantity } },
    });

    if (updatedPart.stockQuantity < 0) {
      throw new ConflictException('Insufficient stock to complete this order');
    }
  }

  const updated = await tx.sparePartOrder.update({
    where: { id: order.id },
    data: {
      status: 'PAID',
      gatewayPaymentId,
      ...(gatewayOrderId ? { gatewayOrderId } : {}),
      paidAt: new Date(),
    },
  });

  return { orderId: updated.id, status: updated.status };
}
