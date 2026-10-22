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
  VerifySparePartOrderDto,
} from './dto/spare-parts.dto';
import {
  computeProviderBadge,
} from '@weyro/api-contracts';
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
  ) {}

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
        stockQuantity: dto.stockQuantity,
        imageUrl: dto.imageUrl,
        kind: dto.kind ?? 'PART',
        description: dto.description,
        estimatedMinutes: dto.estimatedMinutes,
      },
    });
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

    const updated = await this.prisma.$transaction(async (tx) => {
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

      return tx.sparePartOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          gatewayPaymentId: dto.razorpayPaymentId,
          gatewayOrderId: dto.razorpayOrderId,
          paidAt: new Date(),
        },
      });
    });

    return { orderId: updated.id, status: updated.status };
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
