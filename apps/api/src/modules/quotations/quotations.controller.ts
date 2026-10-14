import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';

@Controller()
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  @Post('damage-requests/:requestId/quotations')
  async create(
    @Param('requestId') requestId: string,
    @Body() dto: CreateQuotationDto
  ) {
    return this.service.create(requestId, dto);
  }

  @Get('damage-requests/:requestId/quotations')
  async findByRequest(@Param('requestId') requestId: string) {
    return this.service.findByRequest(requestId);
  }

  @Post('quotations/:id/accept')
  async accept(
    @Param('id') id: string,
    @Body() dto: AcceptQuotationDto
  ) {
    return this.service.accept(id, dto);
  }

  @Get('bookings')
  async getBookings() {
    return this.service.getBookings();
  }

  @Patch('bookings/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; trackingNumber?: string; carrierName?: string }
  ) {
    return this.service.updateStatus(id, body.status, {
      trackingNumber: body.trackingNumber,
      carrierName: body.carrierName,
    });
  }

  @Post('bookings/:id/reviews')
  async addReview(
    @Param('id') id: string,
    @Body() body: { rating: number; comment?: string }
  ) {
    return this.service.addReview(id, body.rating, body.comment);
  }
}
