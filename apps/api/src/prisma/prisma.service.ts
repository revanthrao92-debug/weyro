import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect().catch((err) => {
      // Allow API to boot even if local PostgreSQL is not currently running
      console.warn('Prisma could not connect to PostgreSQL immediately:', err.message);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
