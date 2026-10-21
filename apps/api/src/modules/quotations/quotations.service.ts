import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import {
  validateBookingTransition,
  validatePaymentTransition,
  validateQuotationTransition,
  validateServiceRequestTransition,
} from '../../common/state-machines/state-machines';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    requestId: string,
    providerId: string,
    dto: CreateQuotationDto,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { customer: true },
    });

    if (!request) {
      throw new NotFoundException(`Service request with ID ${requestId} not found`);
    }

    if (
      request.status !== 'OPEN' &&
      request.status !== 'QUOTES_RECEIVED'
    ) {
      throw new BadRequestException(
        `Cannot submit quotation: request is currently ${request.status}`,
      );
    }

    if (request.expiresAt < new Date()) {
      throw new BadRequestException('Cannot submit quotation: request has expired');
    }

    // Check if provider already has an active quote for this request
    const existingQuote = await this.prisma.quotation.findFirst({
      where: {
        requestId,
        providerId,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });

    if (existingQuote) {
      throw new ConflictException(
        'You have already submitted an active quotation for this request',
      );
    }

    // Compute total cost server-side
    const parts = Number(dto.partsCost || 0);
    const labour = Number(dto.labourCost || 0);
    const shipping = Number(dto.shippingCost || 0);
    const totalCost = parts + labour + shipping;

    const [quote] = await this.prisma.$transaction([
      this.prisma.quotation.create({
        data: {
          requestId,
          providerId,
          partsCost: parts,
          labourCost: labour,
          shippingCost: shipping,
          totalCost,
          partCondition: (dto.partCondition as any) || 'OEM',
          warrantyDays: dto.warrantyDays || 30,
          etaDescription: dto.etaDescription,
          deliveryMethod: dto.deliveryMethod || 'DOORSTEP_DELIVERY',
          notes: dto.notes,
          status: 'PENDING',
        },
        include: {
          provider: true,
        },
      }),
      this.prisma.serviceRequest.update({
        where: { id: requestId },
        data: { status: 'QUOTES_RECEIVED' },
      }),
    ]);

    if (request.customer?.userId) {
      this.notifications
        .sendPushNotification({
          userId: request.customer.userId,
          title: 'New Quote Received',
          body: `A verified provider submitted a quotation of ₹${totalCost} for "${request.title}".`,
          data: { requestId, quotationId: quote.id, type: 'new_quote' },
        })
        .catch(() => {});
    }

    return quote;
  }

  async findByRequest(
    requestId: string,
    user: AuthUserPayload,
    cursor?: string,
    limit: number = 20,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${requestId} not found`);
    }

    const isCustomerOwner =
      user.customerProfileId && request.customerId === user.customerProfileId;
    const isAdmin = user.role === 'ADMIN';
    const boundedLimit = Math.min(50, Math.max(1, limit));

    // If customer: can see all quotes on their own request
    if (isCustomerOwner || isAdmin) {
      const items = await this.prisma.quotation.findMany({
        where: { requestId },
        include: { provider: true },
        take: boundedLimit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      return {
        items,
        nextCursor: items.length === boundedLimit ? items[items.length - 1].id : null,
      };
    }

    // If provider: can only see their own quote on this request
    if (user.providerProfileId) {
      const items = await this.prisma.quotation.findMany({
        where: { requestId, providerId: user.providerProfileId },
        include: { provider: true },
        take: boundedLimit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      return {
        items,
        nextCursor: items.length === boundedLimit ? items[items.length - 1].id : null,
      };
    }

    throw new ForbiddenException('You do not have access to quotations for this request');
  }

  async accept(
    quotationId: string,
    user: AuthUserPayload,
    dto: AcceptQuotationDto,
    idempotencyKey?: string,
  ) {
    // Idempotency: return existing booking if this quotation is already accepted into a booking
    const existingBooking = await this.prisma.booking.findUnique({
      where: { quotationId },
      include: {
        quotation: true,
        provider: true,
        customer: true,
        payments: true,
      },
    });

    if (existingBooking) {
      return existingBooking;
    }

    const quote = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        request: true,
        provider: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found`);
    }

    const isCustomerOwner =
      user.customerProfileId && quote.request.customerId === user.customerProfileId;
    const isAdmin = user.role === 'ADMIN';

    if (!isCustomerOwner && !isAdmin) {
      throw new ForbiddenException(
        'You can only accept quotations for your own service requests',
      );
    }

    // Validate state machine transitions
    validateQuotationTransition(quote.status, 'ACCEPTED', user.role);
    validateServiceRequestTransition(quote.request.status, 'ACCEPTED', user.role);

    // Atomic acceptance transaction with guarded update
    return await this.prisma.$transaction(async (tx) => {
      // Guarded update: ensure quote is still pending. If concurrent accept raced, count will be 0
      const updateResult = await tx.quotation.updateMany({
        where: { id: quotationId, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'Quotation has already been accepted or is no longer in pending status',
        );
      }

      // Reject all other competing quotations for this request
      await tx.quotation.updateMany({
        where: {
          requestId: quote.requestId,
          id: { not: quotationId },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      });

      // Update service request status to ACCEPTED
      await tx.serviceRequest.update({
        where: { id: quote.requestId },
        data: { status: 'ACCEPTED' },
      });

      // Create Booking atomically
      const booking = await tx.booking.create({
        data: {
          quotationId: quote.id,
          customerId: quote.request.customerId,
          providerId: quote.providerId,
          status: 'CONFIRMED',
          scheduledAt: dto.scheduledDate ? new Date(dto.scheduledDate) : new Date(),
          completionNotes: dto.notes,
        },
        include: {
          quotation: true,
          provider: true,
          customer: true,
        },
      });

      // Create initial Payment record in PENDING
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: quote.totalCost,
          currency: 'INR',
          status: 'PENDING',
          method: 'UPI',
        },
      });

      return booking;
    });
  }

  async getBookings(
    user: AuthUserPayload,
    cursor?: string,
    limit: number = 20,
    status?: string,
  ) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (user.role === 'ADMIN') {
      // Admin sees all
    } else if (user.customerProfileId && user.role === 'CUSTOMER') {
      where.customerId = user.customerProfileId;
    } else if (user.providerProfileId && user.role === 'PROVIDER') {
      where.providerId = user.providerProfileId;
    } else if (user.role === 'BOTH') {
      where.OR = [
        user.customerProfileId ? { customerId: user.customerProfileId } : undefined,
        user.providerProfileId ? { providerId: user.providerProfileId } : undefined,
      ].filter(Boolean);
    } else {
      where.id = 'none';
    }

    const boundedLimit = Math.min(50, Math.max(1, limit));

    const items = await this.prisma.booking.findMany({
      where,
      take: boundedLimit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        customer: true,
        provider: true,
        quotation: true,
        payments: true,
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items,
      nextCursor: items.length === boundedLimit ? items[items.length - 1].id : null,
    };
  }

  async updateStatus(
    id: string,
    user: AuthUserPayload,
    newStatus: string,
    metadata?: { trackingNumber?: string; carrierName?: string },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        quotation: {
          include: { request: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    const isCustomerOwner =
      user.customerProfileId && booking.customerId === user.customerProfileId;
    const isProviderOwner =
      user.providerProfileId && booking.providerId === user.providerProfileId;
    const isAdmin = user.role === 'ADMIN';

    if (!isCustomerOwner && !isProviderOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to update this booking');
    }

    // Validate state machine transition with actor permissions
    validateBookingTransition(booking.status, newStatus as any, user.role);

    const data: any = { status: newStatus as any };
    if (newStatus === 'IN_PROGRESS' && !booking.startedAt) {
      data.startedAt = new Date();
    }
    if (newStatus === 'COMPLETED' && !booking.completedAt) {
      data.completedAt = new Date();
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data,
        include: {
          customer: true,
          provider: true,
          quotation: true,
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });

      // If work is completed, transition ServiceRequest to COMPLETED as well
      if (newStatus === 'COMPLETED' && booking.quotation?.request) {
        validateServiceRequestTransition(
          booking.quotation.request.status,
          'COMPLETED',
          user.role,
        );
        await tx.serviceRequest.update({
          where: { id: booking.quotation.request.id },
          data: { status: 'COMPLETED' },
        });

        // Trigger payment release/capture per payment state machine
        const latestPayment = booking.payments?.[0];
        if (latestPayment && latestPayment.status === 'AUTHORIZED') {
          validatePaymentTransition(latestPayment.status, 'CAPTURED', 'SYSTEM');
          await tx.payment.update({
            where: { id: latestPayment.id },
            data: { status: 'CAPTURED', paidAt: new Date() },
          });
        }
      }

      return updated;
    });
  }

  async addReview(
    bookingId: string,
    user: AuthUserPayload,
    rating: number,
    comment?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    if (
      user.role !== 'ADMIN' &&
      (!user.customerProfileId || booking.customerId !== user.customerProfileId)
    ) {
      throw new ForbiddenException('Only the booking customer can leave a review');
    }

    if (booking.status !== 'COMPLETED' && user.role !== 'ADMIN') {
      throw new BadRequestException('Reviews can only be submitted for completed bookings');
    }

    return await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          bookingId,
          customerId: booking.customerId,
          providerId: booking.providerId,
          rating: Math.max(1, Math.min(5, Math.round(rating))),
          comment,
        },
      });

      // Recompute provider average rating and review count
      const allReviews = await tx.review.findMany({
        where: { providerId: booking.providerId, status: 'ACTIVE' },
        select: { rating: true },
      });

      const totalReviews = allReviews.length;
      const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
      const avgRating = totalReviews > 0 ? Number((sum / totalReviews).toFixed(1)) : 0;

      await tx.providerProfile.update({
        where: { id: booking.providerId },
        data: {
          avgRating,
          totalReviews,
        },
      });

      return review;
    });
  }
}
