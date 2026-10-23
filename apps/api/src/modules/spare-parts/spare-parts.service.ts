import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSparePartDto,
  CreateSparePartOrderDto,
  UpdateSparePartDto,
  VerifySparePartOrderDto,
} from './dto/spare-parts.dto';
import {
  computeProviderBadge,
} from '@weyro/api-contracts';
import { settleSparePartOrder } from './spare-part-settlement';
import {
  notifyOrderCancelled,
  notifyOrderPaid,
  notifyOrderPlaced,
  notifyOrderRefunded,
} from './spare-part-notifications';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_GATEWAY, PaymentGateway } from '../payments/interfaces/payment-gateway.interface';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';
import { env } from '../../config/env.config';

@Injectable()
export class SparePartsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly notifications: NotificationsService,
  ) {}

  private async notificationContext(order: {
    id: string;
    sparePartId: string;
    customerId: string;
    providerId: string;
    quantity: number;
    totalAmount: unknown;
  }) {
    const [part, customer, provider] = await Promise.all([
      this.prisma.sparePart.findUnique({
        where: { id: order.sparePartId },
        select: { name: true },
      }),
      this.prisma.customerProfile.findUnique({
        where: { id: order.customerId },
        select: { userId: true },
      }),
      this.prisma.providerProfile.findUnique({
        where: { id: order.providerId },
        select: { userId: true },
      }),
    ]);

    return {
      orderId: order.id,
      partName: part?.name ?? 'your order',
      totalAmount: Number(order.totalAmount),
      quantity: order.quantity,
      customerUserId: customer?.userId,
      providerUserId: provider?.userId,
    };
  }

  async findAll(params: {
    search?: string;
    make?: string;
    model?: string;
    condition?: string;
    kind?: string;
    cursor?: string;
    limit?: number;
  }) {
    const boundedLimit = Math.min(50, Math.max(1, params.limit || 20));
    const where: any = { isActive: true };
    const cursorTuple = params.cursor ? decodeCursor(params.cursor) : null;

    if (params.condition) {
      where.condition = params.condition;
    }

    if (params.kind) {
      where.kind = params.kind;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { partNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.make) {
      where.compatibleMakes = { has: params.make };
    }

    if (params.model) {
      where.compatibleModels = { has: params.model };
    }

    const items = await this.prisma.sparePart.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        ...where,
      },
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            verificationStatus: true,
            avgRating: true,
            completedJobs: true,
            isAvailable: true,
          },
        },
      },
    });

    const itemsWithBadge = items.map((item: any) => ({
      ...item,
      provider: {
        ...item.provider,
        badge: computeProviderBadge({
          verificationStatus: item.provider.verificationStatus,
          avgRating: item.provider.avgRating,
          completedJobs: item.provider.completedJobs,
          isAvailable: item.provider.isAvailable,
        }),
      },
    }));

    return {
      items: itemsWithBadge,
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  async findOne(id: string) {
    const part = await this.prisma.sparePart.findFirst({
      where: { id, isActive: true },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            verificationStatus: true,
            avgRating: true,
            completedJobs: true,
            isAvailable: true,
          },
        },
      },
    });

    if (!part) {
      throw new NotFoundException(`Spare part with ID ${id} not found`);
    }

    return {
      ...part,
      provider: {
        ...part.provider,
        badge: computeProviderBadge({
          verificationStatus: part.provider.verificationStatus,
          avgRating: part.provider.avgRating,
          completedJobs: part.provider.completedJobs,
          isAvailable: part.provider.isAvailable,
        }),
      },
    };
  }

  async create(providerId: string, dto: CreateSparePartDto) {
    return this.prisma.sparePart.create({
      data: {
        providerId,
        name: dto.name,
        partNumber: dto.partNumber,
        compatibleMakes: dto.compatibleMakes,
        compatibleModels: dto.compatibleModels,
        condition: dto.condition as any,
        price: dto.price,
        stockQuantity: dto.kind === 'PACKAGE' ? 1 : dto.stockQuantity,
        imageUrl: dto.imageUrl,
        kind: dto.kind ?? 'PART',
        description: dto.description,
        estimatedMinutes: dto.estimatedMinutes,
      },
    });
  }

  async findMine(
    providerId: string | undefined,
    role: string,
    cursor?: string,
    limit?: number,
  ) {
    const boundedLimit = Math.min(50, Math.max(1, limit || 20));
    const cursorTuple = cursor ? decodeCursor(cursor) : null;

    const items = await this.prisma.sparePart.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        deletedAt: null,
        ...(role === 'ADMIN' && !providerId
          ? {}
          : { providerId: providerId ?? 'none' }),
      },
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        _count: { select: { orders: true } },
      },
    });

    return {
      items: items.map(({ _count, ...item }) => ({
        ...item,
        ordersCount: _count.orders,
      })),
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  private async assertOwnership(
    id: string,
    user: { role: string; providerProfileId?: string },
  ) {
    const part = await this.prisma.sparePart.findFirst({
      where: { id, deletedAt: null },
    });

    if (!part) {
      throw new NotFoundException(`Spare part with ID ${id} not found`);
    }

    if (
      user.role !== 'ADMIN' &&
      (!user.providerProfileId || part.providerId !== user.providerProfileId)
    ) {
      throw new ForbiddenException('You do not own this listing');
    }

    return part;
  }

  async update(
    id: string,
    user: { role: string; providerProfileId?: string },
    dto: UpdateSparePartDto,
  ) {
    const part = await this.assertOwnership(id, user);
    const kind = dto.kind ?? part.kind;

    return this.prisma.sparePart.update({
      where: { id },
      data: {
        ...dto,
        condition: dto.condition as any,
        stockQuantity:
          kind === 'PACKAGE'
            ? 1
            : dto.stockQuantity !== undefined
              ? dto.stockQuantity
              : undefined,
      },
    });
  }

  async remove(id: string, user: { role: string; providerProfileId?: string }) {
    await this.assertOwnership(id, user);

    await this.prisma.sparePart.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return { deleted: true };
  }

  async createOrder(
    partId: string,
    customerId: string,
    dto: CreateSparePartOrderDto,
  ) {
    const part = await this.prisma.sparePart.findFirst({
      where: { id: partId, isActive: true, deletedAt: null },
    });

    if (!part) {
      throw new NotFoundException(`Spare part with ID ${partId} not found`);
    }

    // Packages are booked once; stock checks only apply to physical parts
    const quantity = part.kind === 'PACKAGE' ? 1 : dto.quantity;

    if (part.stockQuantity < quantity) {
      throw new ConflictException(
        `Only ${part.stockQuantity} unit(s) left in stock`,
      );
    }

    const totalAmount = Number(part.price) * quantity;

    const existingPending = await this.prisma.sparePartOrder.findFirst({
      where: {
        sparePartId: partId,
        customerId,
        status: 'PENDING',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Reuse an open gateway order so retries don't create duplicate charges
    if (existingPending?.gatewayOrderId) {
      return {
        orderId: existingPending.id,
        quantity: existingPending.quantity,
        totalAmount: Number(existingPending.totalAmount),
        currency: existingPending.currency,
        razorpayOrderId: existingPending.gatewayOrderId,
        keyId: env.RAZORPAY_KEY_ID || 'rzp_test_mock',
      };
    }

    const gatewayOrder = await this.gateway.createOrder({
      amountInPaise: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `rcpt_sp_${partId.substring(0, 8)}`,
      notes: { sparePartId: partId, customerId },
    });

    const order = await this.prisma.sparePartOrder.create({
      data: {
        sparePartId: partId,
        providerId: part.providerId,
        customerId,
        quantity,
        unitPrice: part.price,
        totalAmount,
        currency: 'INR',
        status: 'PENDING',
        gatewayOrderId: gatewayOrder.orderId,
      },
    });

    void this.notificationContext(order)
      .then((context) => notifyOrderPlaced(this.notifications, context))
      .catch(() => {});

    return {
      orderId: order.id,
      quantity: order.quantity,
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      razorpayOrderId: gatewayOrder.orderId,
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_mock',
    };
  }

  async verifyOrderPayment(orderId: string, customerId: string | null, dto: VerifySparePartOrderDto) {
    const order = await this.prisma.sparePartOrder.findUnique({
      where: { id: orderId },
    });

    if (!order || order.deletedAt) {
      throw new NotFoundException(`Spare part order ${orderId} not found`);
    }

    if (customerId && order.customerId !== customerId && customerId !== 'ADMIN') {
      throw new ForbiddenException('Only the order customer can verify payment');
    }

    if (order.status === 'PAID') {
      return { orderId: order.id, status: 'ALREADY_PAID' };
    }

    if (order.status !== 'PENDING') {
      throw new ConflictException('Order is no longer payable');
    }

    if (order.gatewayOrderId && order.gatewayOrderId !== dto.razorpayOrderId) {
      throw new BadRequestException('Mismatched gateway order ID');
    }

    const isValid = this.gateway.verifyPaymentSignature({
      orderId: dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    const updated = await this.prisma.$transaction((tx) =>
      settleSparePartOrder(tx, order, dto.razorpayPaymentId, dto.razorpayOrderId),
    );

    if (updated.status === 'PAID') {
      void this.notificationContext(order)
        .then((context) => notifyOrderPaid(this.notifications, context))
        .catch(() => {});
    }

    return updated;
  }

  async cancelOrder(
    orderId: string,
    customerId: string | null,
    isAdmin: boolean,
  ) {
    const order = await this.prisma.sparePartOrder.findUnique({
      where: { id: orderId },
    });

    if (!order || order.deletedAt) {
      throw new NotFoundException(`Spare part order ${orderId} not found`);
    }

    if (!isAdmin && order.customerId !== customerId) {
      throw new ForbiddenException('Only the order customer can cancel it');
    }

    // Cancelling is idempotent for an already-cancelled order
    if (order.status === 'CANCELLED') {
      return { orderId: order.id, status: 'CANCELLED' };
    }

    // Pending orders never reserved stock, so cancellation is a status flip.
    // Paid orders must go through the refund path instead.
    if (order.status !== 'PENDING') {
      throw new ConflictException(
        `Cannot cancel an order in ${order.status} status`,
      );
    }

    const claimed = await this.prisma.sparePartOrder.updateMany({
      where: { id: order.id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    if (claimed.count === 0) {
      throw new ConflictException('Order is no longer cancellable');
    }

    void this.notificationContext(order)
      .then((context) => notifyOrderCancelled(this.notifications, context))
      .catch(() => {});

    return { orderId: order.id, status: 'CANCELLED' };
  }

  async refundOrder(orderId: string) {
    const order = await this.prisma.sparePartOrder.findUnique({
      where: { id: orderId },
    });

    if (!order || order.deletedAt) {
      throw new NotFoundException(`Spare part order ${orderId} not found`);
    }

    if (order.status === 'REFUNDED') {
      return { orderId: order.id, status: 'REFUNDED' };
    }

    if (order.status !== 'PAID') {
      throw new ConflictException(
        `Cannot refund an order in ${order.status} status`,
      );
    }

    if (!order.gatewayPaymentId) {
      throw new ConflictException('Order has no captured payment to refund');
    }

    // Claim the transition first so concurrent admin actions cannot issue two
    // gateway refunds. Reverted below if the gateway call fails.
    const claimed = await this.prisma.sparePartOrder.updateMany({
      where: { id: order.id, status: 'PAID' },
      data: { status: 'REFUNDED' },
    });

    if (claimed.count === 0) {
      throw new ConflictException('Order is no longer refundable');
    }

    try {
      const refund = await this.gateway.refundPayment({
        paymentId: order.gatewayPaymentId,
        amountInPaise: Math.round(Number(order.totalAmount) * 100),
        notes: { orderId: order.id, reason: 'admin_refund' },
      });

      // Return reserved stock for physical parts; packages never held stock
      const part = await this.prisma.sparePart.findUnique({
        where: { id: order.sparePartId },
        select: { kind: true },
      });

      if (part?.kind !== 'PACKAGE') {
        await this.prisma.sparePart.update({
          where: { id: order.sparePartId },
          data: { stockQuantity: { increment: order.quantity } },
        });
      }

      void this.notificationContext(order)
        .then((context) => notifyOrderRefunded(this.notifications, context))
        .catch(() => {});

      return {
        orderId: order.id,
        status: 'REFUNDED',
        refundId: refund.refundId,
      };
    } catch (error) {
      await this.prisma.sparePartOrder.updateMany({
        where: { id: order.id, status: 'REFUNDED' },
        data: { status: 'PAID' },
      });
      throw error;
    }
  }

  async findMyOrders(customerId: string) {
    return this.prisma.sparePartOrder.findMany({
      where: { customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
        sparePart: {
          select: { id: true, name: true, partNumber: true, imageUrl: true },
        },
      },
    });
  }

  async findDealerOrders(
    providerId: string,
    params: { status?: string; cursor?: string; limit?: number },
  ) {
    const boundedLimit = Math.min(50, Math.max(1, params.limit || 20));
    const cursorTuple = params.cursor ? decodeCursor(params.cursor) : null;
    const where: any = {
      providerId,
      deletedAt: null,
      ...buildCursorWhere(cursorTuple),
    };

    if (params.status) {
      where.status = params.status;
    }

    const items = await this.prisma.sparePartOrder.findMany({
      where,
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
        sparePart: {
          select: { id: true, name: true, partNumber: true, imageUrl: true },
        },
        customer: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return {
      items,
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  async findAdminOrders(params: { status?: string; cursor?: string; limit?: number }) {
    const boundedLimit = Math.min(50, Math.max(1, params.limit || 20));
    const cursorTuple = params.cursor ? decodeCursor(params.cursor) : null;
    const where: any = {
      deletedAt: null,
      ...buildCursorWhere(cursorTuple),
    };

    if (params.status) {
      where.status = params.status;
    }

    const items = await this.prisma.sparePartOrder.findMany({
      where,
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        currency: true,
        status: true,
        gatewayOrderId: true,
        gatewayPaymentId: true,
        paidAt: true,
        createdAt: true,
        sparePart: {
          select: { id: true, name: true, partNumber: true },
        },
        customer: {
          select: { firstName: true, lastName: true },
        },
        provider: {
          select: { businessName: true },
        },
      },
    });

    return {
      items,
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  async findOrderDetail(
    orderId: string,
    user: { role: string; customerProfileId?: string | null; providerProfileId?: string | null },
  ) {
    const order = await this.prisma.sparePartOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        currency: true,
        status: true,
        gatewayOrderId: true,
        gatewayPaymentId: true,
        paidAt: true,
        createdAt: true,
        deletedAt: true,
        customerId: true,
        providerId: true,
        sparePart: {
          select: { id: true, name: true, partNumber: true, imageUrl: true },
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
            // Admin-only contact fields; stripped for customer/dealer views below
            user: { select: { email: true, phone: true } },
          },
        },
        provider: {
          select: {
            businessName: true,
            verificationStatus: true,
            avgRating: true,
            completedJobs: true,
            isAvailable: true,
          },
        },
      },
    });

    if (!order || order.deletedAt) {
      throw new NotFoundException(`Spare part order ${orderId} not found`);
    }

    const isAdmin = user.role === 'ADMIN';
    const isCustomer =
      !!user.customerProfileId && order.customerId === user.customerProfileId;
    const isDealer =
      !!user.providerProfileId && order.providerId === user.providerProfileId;

    if (!isAdmin && !isCustomer && !isDealer) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (isDealer) {
      // Dealer sees the part, itself, and customer names only
      const { customerId: _c, providerId: _p, provider: _prov, gatewayOrderId: _go, gatewayPaymentId: _gp, ...dealerView } = order;
      return {
        ...dealerView,
        customer: {
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
        },
      };
    }

    if (isCustomer && !isAdmin) {
      // Customer: provider masked to business name + badge, no gateway internals
      const {
        gatewayOrderId: _go,
        gatewayPaymentId: _gp,
        customerId: _c,
        providerId: _p,
        ...customerView
      } = order;
      // Customer must never see their own contact details mirrored
      // from the provider/ops context beyond names
      return {
        ...customerView,
        customer: {
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
        },
        provider: {
          businessName: order.provider.businessName,
          badge: computeProviderBadge({
            verificationStatus: order.provider.verificationStatus,
            avgRating: order.provider.avgRating,
            completedJobs: order.provider.completedJobs,
            isAvailable: order.provider.isAvailable,
          }),
        },
      };
    }

    return order;
  }
}
