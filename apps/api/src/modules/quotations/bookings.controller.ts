import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpdateBookingLocationDto } from './dto/update-booking-location.dto';
import { TrackingGateway } from './tracking.gateway';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BookingsQuery, bookingsQuerySchema } from '../../common/dto/query.dto';
import { idParamSchema } from '../../common/dto/id-param.schema';

@Controller()
export class BookingsController {
  constructor(
    private readonly service: BookingsService,
    private readonly tracking: TrackingGateway,
  ) {}

  @Get(['bookings', 'quotations/bookings'])
  async getBookings(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(bookingsQuerySchema)) query: BookingsQuery,
  ) {
    return this.service.getBookings(
      user,
      query.cursor,
      query.limit,
      query.status,
      query.active,
    );
  }

  @Get(['bookings/:id', 'quotations/bookings/:id'])
  async getBooking(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.getBooking(id, user);
  }

  @Patch(['bookings/:id/status', 'quotations/bookings/:id/status'])
  async updateStatus(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: UpdateBookingStatusDto,
  ) {
    const updated = await this.service.updateStatus(id, user, body.status, {
      trackingNumber: body.trackingNumber,
      carrierName: body.carrierName,
      completionNotes: body.completionNotes,
      overrideReason: body.overrideReason,
    });
    this.tracking.emitStatus(id, updated.status);
    return updated;
  }

  @Patch(['bookings/:id/location', 'quotations/bookings/:id/location'])
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async updateLocation(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: UpdateBookingLocationDto,
  ) {
    const location = await this.service.updateLocation(id, user, {
      latitude: body.latitude,
      longitude: body.longitude,
      etaMinutes: body.etaMinutes,
    });

    this.tracking.emitLocation(id, {
      latitude: location.providerLatitude as number,
      longitude: location.providerLongitude as number,
      etaMinutes: location.etaMinutes ?? null,
      updatedAt: (
        location.providerLocationUpdatedAt ?? new Date()
      ).toISOString(),
    });

    return location;
  }

  @Get(['bookings/:id/tracking', 'quotations/bookings/:id/tracking'])
  async getTracking(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.getTracking(id, user);
  }

  @Post(['bookings/:id/reviews', 'quotations/bookings/:id/reviews'])
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  async addReview(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: CreateReviewDto,
  ) {
    return this.service.addReview(id, user, body.rating, body.comment);
  }
}
