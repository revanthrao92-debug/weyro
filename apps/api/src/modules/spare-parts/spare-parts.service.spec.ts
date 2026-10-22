import { SparePartsService } from './spare-parts.service';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../payments/interfaces/payment-gateway.interface';

describe('SparePartsService public projection', () => {
  let service: SparePartsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      sparePart: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'part-1',
          provider: { id: 'prov-1', businessName: 'Parts Co' },
        }),
        create: jest.fn(),
      },
    };
    service = new SparePartsService(mockPrisma, {
      verifyPaymentSignature: jest.fn(),
      createOrder: jest.fn(),
    } as unknown as PaymentGateway);
  });

  it('never selects KYC documents or user ids for the public list', async () => {
    await service.findAll({});

    const args = mockPrisma.sparePart.findMany.mock.calls[0][0];
    expect(args.include.provider.select).not.toHaveProperty(
      'verificationDocuments',
    );
    expect(args.include.provider.select).not.toHaveProperty('userId');
  });

  it('never selects KYC documents or user ids for public detail', async () => {
    await service.findOne('part-1');

    const args = mockPrisma.sparePart.findFirst.mock.calls[0][0];
    expect(args.include.provider.select).not.toHaveProperty(
      'verificationDocuments',
    );
    expect(args.include.provider.select).not.toHaveProperty('userId');
  });
});

describe('SparePartsService order flow', () => {
  const mockGateway = {
    createOrder: jest.fn(),
    verifyPaymentSignature: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    refundPayment: jest.fn(),
  } as unknown as PaymentGateway;

  let mockPrisma: any;
  let service: SparePartsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      sparePart: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      sparePartOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new SparePartsService(mockPrisma, mockGateway);
  });

  it('rejects orders that exceed available stock', async () => {
    mockPrisma.sparePart.findFirst.mockResolvedValue({
      id: 'part-1',
      price: 1000,
      stockQuantity: 1,
      providerId: 'prov-1',
    });

    await expect(
      service.createOrder('part-1', 'cust-1', { quantity: 3 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockGateway.createOrder).not.toHaveBeenCalled();
  });

  it('creates a pending order and a gateway order', async () => {
    mockPrisma.sparePart.findFirst.mockResolvedValue({
      id: 'part-1',
      price: 1499.5,
      stockQuantity: 5,
      providerId: 'prov-1',
    });
    (mockGateway.createOrder as jest.Mock).mockResolvedValue({
      orderId: 'order_gw_1',
      amount: 149950,
      currency: 'INR',
    });
    mockPrisma.sparePartOrder.create.mockResolvedValue({
      id: 'order-1',
      quantity: 2,
      totalAmount: 2999,
      currency: 'INR',
    });

    const result = await service.createOrder('part-1', 'cust-1', {
      quantity: 2,
    });

    expect(result.razorpayOrderId).toBe('order_gw_1');
    expect(result.totalAmount).toBe(2999);
    expect(mockPrisma.sparePartOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          gatewayOrderId: 'order_gw_1',
        }),
      }),
    );
  });

  it('rejects payment verification with a bad signature', async () => {
    mockPrisma.sparePartOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      customerId: 'cust-1',
      gatewayOrderId: 'order_gw_1',
      quantity: 1,
      sparePartId: 'part-1',
    });
    (mockGateway.verifyPaymentSignature as jest.Mock).mockReturnValue(false);

    await expect(
      service.verifyOrderPayment('order-1', 'cust-1', {
        razorpayOrderId: 'order_gw_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'invalid-signature-value',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not decrement stock when verification fails', async () => {
    mockPrisma.sparePartOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      customerId: 'cust-1',
      gatewayOrderId: 'order_gw_1',
      quantity: 1,
      sparePartId: 'part-1',
    });
    (mockGateway.verifyPaymentSignature as jest.Mock).mockReturnValue(false);

    await service
      .verifyOrderPayment('order-1', 'cust-1', {
        razorpayOrderId: 'order_gw_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'invalid-signature-value',
      })
      .catch(() => undefined);

    expect(mockPrisma.sparePart.update).not.toHaveBeenCalled();
  });

  it('marks the order paid and decrements stock with a valid signature', async () => {
    mockPrisma.sparePartOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      customerId: 'cust-1',
      gatewayOrderId: 'order_gw_1',
      quantity: 2,
      sparePartId: 'part-1',
    });
    (mockGateway.verifyPaymentSignature as jest.Mock).mockReturnValue(true);
    const tx = {
      sparePart: { update: jest.fn().mockResolvedValue({ stockQuantity: 3 }) },
      sparePartOrder: {
        update: jest.fn().mockResolvedValue({ id: 'order-1', status: 'PAID' }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await service.verifyOrderPayment('order-1', 'cust-1', {
      razorpayOrderId: 'order_gw_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'validsignature123',
    });

    expect(result.status).toBe('PAID');
    expect(tx.sparePart.update).toHaveBeenCalledWith({
      where: { id: 'part-1' },
      data: { stockQuantity: { decrement: 2 } },
    });
    expect(tx.sparePartOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
  });

  it('masks provider details in customer order history', async () => {
    mockPrisma.sparePartOrder.findMany.mockResolvedValue([]);
    await service.findMyOrders('cust-1');

    const args = mockPrisma.sparePartOrder.findMany.mock.calls[0][0];
    expect(args.select.sparePart.select).not.toHaveProperty('provider');
    expect(Object.keys(args.select)).not.toContain('providerId');
  });
});
