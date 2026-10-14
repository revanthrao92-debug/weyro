import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  private memoryQuotes: any[] = [
    {
      id: 'q_01',
      requestId: 'req_seed_01',
      providerId: 'prov_01',
      providerName: 'Apex OEM Auto Dismantlers',
      providerType: 'PARTS_DEALER',
      partsCost: 1450,
      labourCost: 0,
      totalCost: 1450,
      partCondition: 'OEM',
      warrantyDays: 90,
      etaDescription: '2 business days',
      deliveryMethod: 'PARTS_COURIER',
      notes: 'Genuine OEM LED matrix unit in pristine condition. Includes insured courier shipping.',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    },
  ];

  private memoryBookings: any[] = [];

  async create(requestId: string, dto: CreateQuotationDto) {
    try {
      const quote = await this.prisma.quotation.create({
        data: {
          requestId,
          providerId: dto.providerId,
          partsCost: dto.partsCost,
          labourCost: dto.labourCost || 0,
          shippingCost: dto.shippingCost || 0,
          totalCost: dto.totalCost,
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
      });

      await this.prisma.serviceRequest.update({
        where: { id: requestId },
        data: { status: 'QUOTES_RECEIVED' },
      });

      return quote;
    } catch {
      const newQuote = {
        id: `q_${Date.now()}`,
        requestId,
        ...dto,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      this.memoryQuotes.unshift(newQuote);
      return newQuote;
    }
  }

  async accept(quotationId: string, dto: AcceptQuotationDto) {
    try {
      const quote = await this.prisma.quotation.findUnique({
        where: { id: quotationId },
        include: { request: true },
      });

      if (!quote) throw new NotFoundException('Quotation not found');

      // Update quote to ACCEPTED and reject others
      await this.prisma.quotation.update({
        where: { id: quotationId },
        data: { status: 'ACCEPTED' },
      });

      await this.prisma.quotation.updateMany({
        where: {
          requestId: quote.requestId,
          id: { not: quotationId },
        },
        data: { status: 'REJECTED' },
      });

      await this.prisma.serviceRequest.update({
        where: { id: quote.requestId },
        data: { status: 'ACCEPTED' },
      });

      const booking = await this.prisma.booking.create({
        data: {
          quotationId: quote.id,
          customerId: quote.request.customerId,
          providerId: quote.providerId,
          status: 'CONFIRMED',
        },
      });

      return {
        booking,
        message: 'Quotation accepted and booking confirmed.',
      };
    } catch {
      const targetQuote = this.memoryQuotes.find((q) => q.id === quotationId);
      if (!targetQuote) throw new NotFoundException('Quotation not found');

      targetQuote.status = 'ACCEPTED';
      this.memoryQuotes
        .filter((q) => q.requestId === targetQuote.requestId && q.id !== quotationId)
        .forEach((q) => (q.status = 'REJECTED'));

      const booking = {
        id: `bk_${Date.now()}`,
        quotationId: targetQuote.id,
        requestId: targetQuote.requestId,
        status: 'CONFIRMED',
        deliveryAddress: dto.deliveryAddress,
        scheduledDate: dto.scheduledDate,
        totalCost: targetQuote.totalCost,
        confirmedAt: new Date().toISOString(),
      };
      this.memoryBookings.unshift(booking);

      return {
        booking,
        message: 'Quotation accepted and booking confirmed.',
      };
    }
  }

  async findByRequest(requestId: string) {
    try {
      return await this.prisma.quotation.findMany({
        where: { requestId },
        include: { provider: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return this.memoryQuotes.filter((q) => q.requestId === requestId);
    }
  }

  async getBookings() {
    try {
      return await this.prisma.booking.findMany({
        include: {
          customer: true,
          provider: true,
          quotation: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return this.memoryBookings;
    }
  }
}
