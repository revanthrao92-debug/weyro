import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  @Post('damage-requests/:requestId/quotations')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  async create(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateQuotationDto,
  ) {
    if (user.role !== 'ADMIN' && user.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenException(
        'Only verified providers can submit quotations',
      );
    }
    if (!user.providerProfileId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Provider profile required to submit quotations',
      );
    }
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
  ) {
    return this.service.findByRequest(requestId, user);
  }

  @Post('quotations/:id/accept')
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  async accept(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: AcceptQuotationDto,
  ) {
    return this.service.accept(id, user, dto);
  }

  @Get('bookings')
  async getBookings(@CurrentUser() user: AuthUserPayload) {
    return this.service.getBookings(user);
  }

  @Patch('bookings/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body()
    body: { status: string; trackingNumber?: string; carrierName?: string },
  ) {
    return this.service.updateStatus(id, user, body.status, {
      trackingNumber: body.trackingNumber,
      carrierName: body.carrierName,
    });
  }

  @Post('bookings/:id/reviews')
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  async addReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.service.addReview(id, user, body.rating, body.comment);
  }
}
