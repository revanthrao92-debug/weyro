import { refundCancelledSpareOrder, settleSparePartOrderPayment } from './settle-payment';

function tx(stockLeft: number) {
  return {
    sparePartOrder: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }), // the PENDING -> PAID claim
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'o1', status: 'PAID' }),
    },
    sparePart: {
      findUnique: jest.fn().mockResolvedValue({ kind: 'PART' }),
      // Conditional decrement: succeeds only while enough stock is left.
      updateMany: jest.fn().mockImplementation(async ({ where }: any) => ({
        count: stockLeft >= where.stockQuantity.gte ? 1 : 0,
      })),
    },
  } as any;
}

describe('settleSparePartOrderPayment: part sold out after the customer paid', () => {
  it('takes the stock only if it is still there', async () => {
    const t = tx(1);
    const r = await settleSparePartOrderPayment(t, { orderId: 'o1', sparePartId: 'p1', quantity: 1 }, { gatewayPaymentId: 'pay_1' });
    expect(r).toMatchObject({ applied: true, status: 'PAID' });
    expect(t.sparePart.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stockQuantity: { gte: 1 } },
      data: { stockQuantity: { decrement: 1 } },
    });
  });

  it('cancels the order for a refund instead of throwing (which failed on every retry)', async () => {
    const t = tx(0);
    const r = await settleSparePartOrderPayment(t, { orderId: 'o1', sparePartId: 'p1', quantity: 1 }, { gatewayPaymentId: 'pay_1' });
    expect(r).toMatchObject({ applied: false, outOfStock: true, status: 'CANCELLED' });
    expect(t.sparePartOrder.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED', paidAt: null }, // never counted as a sale
    });
  });

  it('last unit, two buyers: the first gets the part, the second is cancelled for a refund', async () => {
    let stock = 1;
    const shared = tx(0);
    shared.sparePart.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (stock < where.stockQuantity.gte) return { count: 0 };
      stock -= data.stockQuantity.decrement;
      return { count: 1 };
    });
    const first = await settleSparePartOrderPayment(shared, { orderId: 'a', sparePartId: 'p1', quantity: 1 }, { gatewayPaymentId: 'pay_a' });
    const second = await settleSparePartOrderPayment(shared, { orderId: 'b', sparePartId: 'p1', quantity: 1 }, { gatewayPaymentId: 'pay_b' });
    expect(first.applied).toBe(true);
    expect(second.outOfStock).toBe(true);
    expect(stock).toBe(0); // never negative
  });
});

describe('refundCancelledSpareOrder', () => {
  const prisma = () => ({
    sparePartOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  }) as any;

  it('refunds the full amount and marks the order refunded', async () => {
    const p = prisma();
    const gateway = { findRefund: jest.fn().mockResolvedValue(null), refundPayment: jest.fn().mockResolvedValue({ refundId: 'rf_1' }) };
    await refundCancelledSpareOrder(p, gateway as any, { orderId: 'o1', gatewayPaymentId: 'pay_1', amount: '749.50', reason: 'sold_out_after_capture' });
    expect(gateway.refundPayment).toHaveBeenCalledWith({ paymentId: 'pay_1', amountInPaise: 74950, notes: { orderId: 'o1', reason: 'sold_out_after_capture' } });
    expect(p.sparePartOrder.updateMany).toHaveBeenCalledWith({ where: { id: 'o1', status: 'CANCELLED' }, data: { status: 'REFUNDED' } });
  });

  it('never refunds twice: reuses a refund the gateway already has', async () => {
    const p = prisma();
    const gateway = { findRefund: jest.fn().mockResolvedValue({ refundId: 'rf_old' }), refundPayment: jest.fn() };
    await refundCancelledSpareOrder(p, gateway as any, { orderId: 'o1', gatewayPaymentId: 'pay_1', amount: 749, reason: 'x' });
    expect(gateway.refundPayment).not.toHaveBeenCalled();
  });

  it('does not throw when the gateway refuses (logged for follow-up)', async () => {
    const gateway = { findRefund: jest.fn().mockResolvedValue(null), refundPayment: jest.fn().mockRejectedValue(new Error('down')) };
    await expect(refundCancelledSpareOrder(prisma(), gateway as any, { orderId: 'o1', gatewayPaymentId: 'pay_1', amount: 749, reason: 'x' })).resolves.toBeUndefined();
  });
});
