import { serializeBooking } from './booking-serializer';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { assertPaymentSatisfied, validateBookingTransition, validateServiceRequestTransition } from '../../common/state-machines/state-machines';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { haversineDistanceKm } from '@weyro/api-contracts';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';

/**
 * Bookings: reading them, moving them through their status machine (with the
 * payment rules and refunds), live tracking and reviews. Split out of
 * QuotationsService; behaviour and routes are unchanged.
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    // Optional so the many unit suites that build this service by hand keep
    // working; in the real app it is always provided (PaymentsModule).
    @Optional() private readonly payments?: PaymentsService,
  ) {}

  async getBooking(id: string, user: AuthUserPayload) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        provider: true,
        quotation: {
          include: { request: { include: { vehicle: true, media: true } } },
        },
        payments: true,
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    const isCustomerOwner =
      user.customerProfileId && booking.customerId === user.customerProfileId;
    const isProviderOwner =
      user.providerProfileId && booking.providerId === user.providerProfileId;

    if (!isCustomerOwner && !isProviderOwner && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'You do not have permission to view this booking',
      );
    }

    return serializeBooking(booking, user.role);
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
    const cursorTuple = cursor ? decodeCursor(cursor) : null;

    const items = await this.prisma.booking.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        ...where,
      },
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        customer: true,
        provider: true,
        quotation: {
          include: { request: { include: { vehicle: true, media: true } } },
        },
        payments: true,
        review: true,
      },
    });

    return {
      items: items.map((item) =>
        serializeBooking(item, user.role),
      ),
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  async updateStatus(
    id: string,
    user: AuthUserPayload,
    newStatus: string,
    metadata?: {
      trackingNumber?: string;
      carrierName?: string;
      completionNotes?: string;
      overrideReason?: string;
    },
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

    // A BOTH account can own this booking on either side. The acting side must
    // come from the ownership relation, not from the account's global role.
    const actorRole: 'ADMIN' | 'PROVIDER' | 'CUSTOMER' = isAdmin
      ? 'ADMIN'
      : isProviderOwner
        ? 'PROVIDER'
        : 'CUSTOMER';

    validateBookingTransition(booking.status, newStatus as any, actorRole);

    // M3: a booking cannot complete (or, if the policy is switched, start)
    // without a CAPTURED payment. Admins may override with an audited reason.
    const latestPayment = booking.payments?.[0];
    const paymentGate = assertPaymentSatisfied({
      targetStatus: newStatus as any,
      paymentStatus: latestPayment?.status as any,
      actorRole,
      overrideReason: metadata?.overrideReason,
    });

    const data: any = { status: newStatus as any };
    if (metadata?.trackingNumber !== undefined) {
      data.trackingNumber = metadata.trackingNumber;
    }
    if (metadata?.carrierName !== undefined) {
      data.carrierName = metadata.carrierName;
    }
    if (metadata?.completionNotes !== undefined) {
      data.completionNotes = metadata.completionNotes;
    }
    if (newStatus === 'IN_PROGRESS' && !booking.startedAt) {
      data.startedAt = new Date();
    }
    if (newStatus === 'COMPLETED' && !booking.completedAt) {
      data.completedAt = new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // M2: compare-and-set. The row is only written if it is still in the
      // status we validated the transition against; a concurrent update (e.g.
      // the customer cancelling while the provider completes) makes this match
      // zero rows instead of silently overwriting it.
      const claimed = await tx.booking.updateMany({
        where: { id, status: booking.status },
        data,
      });
      if (claimed.count === 0) {
        throw new ConflictException('Booking changed, refresh and try again');
      }
      const updatedBooking = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          provider: true,
          quotation: true,
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (paymentGate.overridden) {
        await tx.auditLog.create({
          data: {
            actorId: user.sub,
            actorRole: user.role,
            action: 'booking.payment_override',
            entityType: 'Booking',
            entityId: id,
            oldValues: { status: booking.status, paymentStatus: latestPayment?.status ?? null },
            newValues: { status: newStatus, reason: paymentGate.reason },
          },
        });
      }

      // Starting and completing a job must move the request through its own
      // state machine (ACCEPTED -> IN_PROGRESS -> COMPLETED).
      if (newStatus === 'IN_PROGRESS' && booking.quotation?.request) {
        const request = booking.quotation.request;
        if (request.status === 'ACCEPTED') {
          validateServiceRequestTransition('ACCEPTED', 'IN_PROGRESS', actorRole);
          await this.moveRequest(tx, request.id, 'ACCEPTED', 'IN_PROGRESS');
        }
      }

      // If work is completed, transition ServiceRequest to COMPLETED as well
      if (newStatus === 'COMPLETED' && booking.quotation?.request) {
        const request = booking.quotation.request;
        if (request.status === 'ACCEPTED') {
          validateServiceRequestTransition('ACCEPTED', 'IN_PROGRESS', actorRole);
          await this.moveRequest(tx, request.id, 'ACCEPTED', 'IN_PROGRESS');
        }
        const fromStatus = request.status === 'ACCEPTED' ? 'IN_PROGRESS' : request.status;
        validateServiceRequestTransition(fromStatus, 'COMPLETED', actorRole);
        await this.moveRequest(tx, request.id, fromStatus, 'COMPLETED');

      }

      return updatedBooking;
    });

    // M3: cancelling after the customer paid refunds them through the gateway.
    // Never fails the cancellation: a refund problem is logged and audited by
    // PaymentsService and leaves the payment CAPTURED for manual follow-up.
    if (newStatus === 'CANCELLED' && latestPayment?.status === 'CAPTURED' && this.payments) {
      try {
        await this.payments.refundCapturedBookingPayment(latestPayment.id, {
          reason: 'booking_cancelled',
          actorId: user.sub,
          actorRole: user.role,
        });
        (updated as any).payments = await this.prisma.payment.findMany({
          where: { bookingId: id },
          orderBy: { createdAt: 'desc' },
        });
      } catch (error) {
        this.logger.error(
          `Refund after cancelling booking ${id} threw: ${(error as Error).message}`,
        );
      }
    }

    // Notify opposite party of booking status update
    try {
      const targetUserIds: string[] = [];
      if (isCustomerOwner) {
        const p = await this.prisma.providerProfile.findUnique({
          where: { id: booking.providerId },
          select: { userId: true },
        });
        if (p?.userId) targetUserIds.push(p.userId);
      } else if (isProviderOwner) {
        const c = await this.prisma.customerProfile.findUnique({
          where: { id: booking.customerId },
          select: { userId: true },
        });
        if (c?.userId) targetUserIds.push(c.userId);
      } else {
        const [c, p] = await Promise.all([
          this.prisma.customerProfile.findUnique({
            where: { id: booking.customerId },
            select: { userId: true },
          }),
          this.prisma.providerProfile.findUnique({
            where: { id: booking.providerId },
            select: { userId: true },
          }),
        ]);
        if (c?.userId) targetUserIds.push(c.userId);
        if (p?.userId) targetUserIds.push(p.userId);
      }

      for (const targetUserId of targetUserIds) {
        this.notifications
          .sendPushNotification({
            userId: targetUserId,
            title: `Booking Update: ${newStatus}`,
            body: `Booking #${booking.id.slice(0, 8)} status changed to ${newStatus}.`,
            data: {
              type: 'BOOKING_STATUS_CHANGED',
              bookingId: booking.id,
              status: newStatus,
            },
          })
          .catch(() => {});
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return serializeBooking(updated, user.role);
  }

  /** M2: compare-and-set a service request's status inside a transaction. */
  private async moveRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    from: string,
    to: string,
  ): Promise<void> {
    const moved = await tx.serviceRequest.updateMany({
      where: { id: requestId, status: from as never },
      data: { status: to as never },
    });
    if (moved.count === 0) {
      throw new ConflictException('Request changed, refresh and try again');
    }
  }

  async updateLocation(
    bookingId: string,
    user: AuthUserPayload,
    input: { latitude: number; longitude: number; etaMinutes?: number },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { quotation: { include: { request: true } } },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const isProviderOwner =
      user.providerProfileId && booking.providerId === user.providerProfileId;
    const isAdmin = user.role === 'ADMIN';

    if (!isProviderOwner && !isAdmin) {
      throw new ForbiddenException(
        'Only the assigned provider can share location for this booking',
      );
    }

    if (
      booking.status === 'COMPLETED' ||
      booking.status === 'CANCELLED' ||
      booking.status === 'DISPUTED'
    ) {
      throw new BadRequestException(
        `Cannot share location for a ${booking.status.toLowerCase()} booking`,
      );
    }

    const request = booking.quotation?.request;
    let etaMinutes = input.etaMinutes;
    if (etaMinutes === undefined && request) {
      const isTowing = request.category === 'TOWING';
      const headingToDropoff =
        isTowing && booking.status === 'IN_PROGRESS';
      const destination =
        headingToDropoff &&
        typeof request.dropoffLatitude === 'number' &&
        typeof request.dropoffLongitude === 'number'
          ? {
              latitude: request.dropoffLatitude,
              longitude: request.dropoffLongitude,
            }
          : { latitude: request.latitude, longitude: request.longitude };

      // Assume 30 km/h average city speed for a conservative ETA.
      const distanceKm = haversineDistanceKm(
        { latitude: input.latitude, longitude: input.longitude },
        destination,
      );
      etaMinutes = Math.max(1, Math.ceil((distanceKm / 30) * 60));
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        providerLatitude: input.latitude,
        providerLongitude: input.longitude,
        providerLocationUpdatedAt: new Date(),
        etaMinutes: etaMinutes ?? booking.etaMinutes,
      },
      select: {
        id: true,
        status: true,
        providerLatitude: true,
        providerLongitude: true,
        providerLocationUpdatedAt: true,
        etaMinutes: true,
      },
    });

    return updated;
  }

  async getTracking(bookingId: string, user: AuthUserPayload) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        customerId: true,
        providerId: true,
        providerLatitude: true,
        providerLongitude: true,
        providerLocationUpdatedAt: true,
        etaMinutes: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const canAccess =
      user.role === 'ADMIN' ||
      (user.customerProfileId && user.customerProfileId === booking.customerId) ||
      (user.providerProfileId && user.providerProfileId === booking.providerId);

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    return {
      bookingId: booking.id,
      status: booking.status,
      providerLatitude: booking.providerLatitude,
      providerLongitude: booking.providerLongitude,
      providerLocationUpdatedAt: booking.providerLocationUpdatedAt,
      etaMinutes: booking.etaMinutes,
    };
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
