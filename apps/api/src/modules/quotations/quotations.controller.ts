import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpdateBookingLocationDto } from './dto/update-booking-location.dto';
import { TrackingGateway } from './tracking.gateway';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { VerifiedProviderGuard } from '../../common/guards/verified-provider.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import {
  BookingsQuery,
  bookingsQuerySchema,
  CursorPaginationQuery,
  cursorPaginationSchema,
} from '../../common/dto/query.dto';

const myQuotationsQuerySchema = cursorPaginationSchema.extend({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'])
    .optional(),
});

type MyQuotationsQuery = z.infer<typeof myQuotationsQuerySchema>;

@Controller()
export class QuotationsController {
  constructor(
    private readonly service: QuotationsService,
    private readonly tracking: TrackingGateway,
  ) {}

  @Post('damage-requests/:requestId/quotations')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  @UseGuards(VerifiedProviderGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async create(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.service.create(
      requestId,
      user.providerProfileId || user.sub,
      dto,
    );
  }

  @Get('damage-requests/:requestId/quotations')
  async findByRequest(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(cursorPaginationSchema))
    query: CursorPaginationQuery,
  ) {
    return this.service.findByRequest(
      requestId,
      user,
      query.cursor,
      query.limit,
    );
  }

  @Post('quotations/:id/accept')
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async accept(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: AcceptQuotationDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.accept(id, user, dto, idempotencyKey);
  }

  @Get('quotations/my')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  async getMyQuotations(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(myQuotationsQuerySchema))
    query: MyQuotationsQuery,
  ) {
    return this.service.getMyQuotations(
      user,
      query.cursor,
      query.limit,
      query.status,
    );
  }

  @Post('quotations/:id/withdraw')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  async withdraw(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.withdrawQuotation(id, user);
  }

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
    );
  }

  @Get(['bookings/:id', 'quotations/bookings/:id'])
  async getBooking(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.getBooking(id, user);
  }

  @Patch(['bookings/:id/status', 'quotations/bookings/:id/status'])
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: UpdateBookingStatusDto,
  ) {
    const updated = await this.service.updateStatus(id, user, body.status, {
      trackingNumber: body.trackingNumber,
      carrierName: body.carrierName,
    });
    this.tracking.emitStatus(id, updated.status);
    return updated;
  }

  @Patch(['bookings/:id/location', 'quotations/bookings/:id/location'])
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async updateLocation(
    @Param('id') id: string,
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
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.getTracking(id, user);
  }

  @Post(['bookings/:id/reviews', 'quotations/bookings/:id/reviews'])
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  async addReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: CreateReviewDto,
  ) {
    return this.service.addReview(id, user, body.rating, body.comment);
  }
}
