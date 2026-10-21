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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { VerifiedProviderGuard } from '../../common/guards/verified-provider.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  BookingsQuery,
  bookingsQuerySchema,
  CursorPaginationQuery,
  cursorPaginationSchema,
} from '../../common/dto/query.dto';

@Controller()
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

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

  @Patch(['bookings/:id/status', 'quotations/bookings/:id/status'])
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: UpdateBookingStatusDto,
  ) {
    return this.service.updateStatus(id, user, body.status, {
      trackingNumber: body.trackingNumber,
      carrierName: body.carrierName,
    });
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
