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
      sparePart: {
        findUnique: jest.fn().mockResolvedValue({ kind: 'PART' }),
        update: jest.fn().mockResolvedValue({ stockQuantity: 3 }),
      },
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
    expect(tx.sparePart.findUnique).toHaveBeenCalled();
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

  it('packages are booked once regardless of requested quantity', async () => {
    mockPrisma.sparePart.findFirst.mockResolvedValue({
      id: 'pkg-1',
      kind: 'PACKAGE',
      price: 2500,
      stockQuantity: 1,
      providerId: 'prov-1',
    });
    (mockGateway.createOrder as jest.Mock).mockResolvedValue({
      orderId: 'order_gw_2',
      amount: 250000,
      currency: 'INR',
    });
    mockPrisma.sparePartOrder.create.mockResolvedValue({
      id: 'order-2',
      quantity: 1,
      totalAmount: 2500,
      currency: 'INR',
    });

    const result = await service.createOrder('pkg-1', 'cust-1', {
      quantity: 5,
    });

    expect(result.quantity).toBe(1);
    expect(mockPrisma.sparePartOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 1 }),
      }),
    );
  });

  it('does not decrement stock for packages on successful payment', async () => {
    mockPrisma.sparePartOrder.findUnique.mockResolvedValue({
      id: 'order-pkg',
      status: 'PENDING',
      customerId: 'cust-1',
      gatewayOrderId: 'order_gw_1',
      quantity: 1,
      sparePartId: 'pkg-1',
    });
    (mockGateway.verifyPaymentSignature as jest.Mock).mockReturnValue(true);
    const tx = {
      sparePart: {
        findUnique: jest.fn().mockResolvedValue({ kind: 'PACKAGE' }),
        update: jest.fn(),
      },
      sparePartOrder: {
        update: jest.fn().mockResolvedValue({ id: 'order-pkg', status: 'PAID' }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await service.verifyOrderPayment('order-pkg', 'cust-1', {
      razorpayOrderId: 'order_gw_1',
      razorpayPaymentId: 'pay_pkg',
      razorpaySignature: 'validsignature123',
    });

    expect(result.status).toBe('PAID');
    expect(tx.sparePart.update).not.toHaveBeenCalled();
  });

  it('masks provider details in customer order history', async () => {
    mockPrisma.sparePartOrder.findMany.mockResolvedValue([]);
    await service.findMyOrders('cust-1');

    const args = mockPrisma.sparePartOrder.findMany.mock.calls[0][0];
    expect(args.select.sparePart.select).not.toHaveProperty('provider');
    expect(Object.keys(args.select)).not.toContain('providerId');
  });

  it('dealer order list shows customer names but no phone, user id, or gateway fields', async () => {
    mockPrisma.sparePartOrder.findMany.mockResolvedValue([
      {
        id: 'o1',
        customer: { firstName: 'A', lastName: 'B' },
        createdAt: new Date('2024-01-01T00:00:00Z'),
      },
    ]);
    const result = await service.findDealerOrders('prov-1', { status: 'PAID' });

    const args = mockPrisma.sparePartOrder.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ providerId: 'prov-1', status: 'PAID' });
    expect(args.select.customer.select).toEqual({
      firstName: true,
      lastName: true,
    });
    expect(args.select).not.toHaveProperty('gatewayOrderId');
    expect(args.select).not.toHaveProperty('gatewayPaymentId');
    expect(result.items[0]).not.toHaveProperty('phone');
  });

  it('admin order list includes gateway reconciliation fields', async () => {
    mockPrisma.sparePartOrder.findMany.mockResolvedValue([
      {
        id: 'o1',
        gatewayOrderId: 'order_gw',
        gatewayPaymentId: 'pay_1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      },
    ]);
    const result = await service.findAdminOrders({});

    const args = mockPrisma.sparePartOrder.findMany.mock.calls[0][0];
    expect(args.where).not.toHaveProperty('providerId');
    expect(args.select).toHaveProperty('gatewayOrderId', true);
    expect(args.select).toHaveProperty('gatewayPaymentId', true);
    expect(result.items[0].gatewayPaymentId).toBe('pay_1');
  });

  describe('findOrderDetail role matrix', () => {
    const baseOrder = {
      id: 'order-1',
      deletedAt: null,
      customerId: 'cust-1',
      providerId: 'prov-1',
      quantity: 1,
      unitPrice: 100,
      totalAmount: 100,
      currency: 'INR',
      status: 'PAID',
      gatewayOrderId: 'order_gw',
      gatewayPaymentId: 'pay_1',
      paidAt: new Date(),
      createdAt: new Date(),
      sparePart: { id: 'part-1', name: 'Part', partNumber: 'P1', imageUrl: null },
      customer: { firstName: 'First', lastName: 'Last', user: { email: 'c@x.com', phone: '9999' } },
      provider: {
        businessName: 'Parts Co',
        verificationStatus: 'VERIFIED',
        avgRating: 4.6,
        completedJobs: 120,
        isAvailable: true,
      },
    };

    beforeEach(() => {
      mockPrisma.sparePartOrder.findUnique.mockImplementation(async () => ({
        ...baseOrder,
      }));
    });

    it('customer gets provider business name + badge but no gateway phone or ids', async () => {
      const detail = await service.findOrderDetail('order-1', {
        role: 'CUSTOMER',
        customerProfileId: 'cust-1',
        providerProfileId: null,
      });

      expect(detail.provider.businessName).toBe('Parts Co');
      expect(detail.provider.badge).toBe('PLATINUM');
      expect(detail).not.toHaveProperty('gatewayPaymentId');
      expect(detail).not.toHaveProperty('customerId');
      expect(detail).not.toHaveProperty('providerId');
    });

    it('dealer gets customer names but no gateway internals or provider block', async () => {
      const detail = await service.findOrderDetail('order-1', {
        role: 'PROVIDER',
        customerProfileId: null,
        providerProfileId: 'prov-1',
      });

      expect(detail.customer).toEqual({ firstName: 'First', lastName: 'Last' });
      expect((detail as any).customer.user).toBeUndefined();
      expect(detail).not.toHaveProperty('gatewayOrderId');
      expect(detail).not.toHaveProperty('provider');
    });

    it('admin gets the full reconciliation record including customer contact', async () => {
      const detail = await service.findOrderDetail('order-1', {
        role: 'ADMIN',
        customerProfileId: null,
        providerProfileId: null,
      });

      expect(detail.gatewayOrderId).toBe('order_gw');
      expect(detail.customerId).toBe('cust-1');
      expect(detail.provider).toBeDefined();
      expect((detail as any).customer?.user).toBeDefined();
    });

    it('rejects unrelated roles with 403', async () => {
      await expect(
        service.findOrderDetail('order-1', {
          role: 'CUSTOMER',
          customerProfileId: 'someone-else',
          providerProfileId: null,
        }),
      ).rejects.toMatchObject({ status: 403 });
    });
  });
});
