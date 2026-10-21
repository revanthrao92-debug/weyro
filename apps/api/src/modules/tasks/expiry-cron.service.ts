import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpiryCronService {
  private readonly logger = new Logger(ExpiryCronService.name);

  constructor(private readonly prisma: PrismaService) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiration() {
    const now = new Date();

    try {
      // 1. Expire Service Requests past expiresAt
      const expiredRequests = await this.prisma.serviceRequest.updateMany({
        where: {
          status: { in: ['OPEN', 'QUOTES_RECEIVED'] },
          expiresAt: { lt: now },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (expiredRequests.count > 0) {
        this.logger.log(`Expired ${expiredRequests.count} stale service request(s)`);
      }

      // 2. Expire pending quotations attached to expired or closed requests
      const expiredQuotes = await this.prisma.quotation.updateMany({
        where: {
          status: 'PENDING',
          request: {
            status: { in: ['EXPIRED', 'CANCELLED'] },
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (expiredQuotes.count > 0) {
        this.logger.log(`Expired ${expiredQuotes.count} pending quotation(s)`);
      }
    } catch (err: any) {
      this.logger.error(`Error executing expiration cron: ${err.message}`, err.stack);
    }
  }
}
