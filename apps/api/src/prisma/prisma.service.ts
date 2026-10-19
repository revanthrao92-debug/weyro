import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Fail fast on app boot if the database is unreachable
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
