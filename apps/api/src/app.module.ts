import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { DamageRequestsModule } from './modules/damage-requests/damage-requests.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { AdminModule } from './modules/admin/admin.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SparePartsModule } from './modules/spare-parts/spare-parts.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { DriverGoModule } from './modules/driver-go/driver-go.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { PinoLogger } from './common/logger/pino.logger';
import { env } from './config/env.config';

// STEP 7 — Redis-backed throttler storage when REDIS_URL is present; the
// in-memory storage remains the fallback for single-instance dev/test.
const USE_REDIS_THROTTLER = Boolean(env.REDIS_URL);

@Module({
  imports: [
    ThrottlerModule.forRoot(
      USE_REDIS_THROTTLER
        ? {
            throttlers: [{ ttl: 60000, limit: 100 }],
            storage: new ThrottlerStorageRedisService(env.REDIS_URL),
          }
        : [{ ttl: 60000, limit: 100 }],
    ),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    DamageRequestsModule,
    QuotationsModule,
    PaymentsModule,
    SparePartsModule,
    UploadsModule,
    NotificationsModule,
    ChatModule,
    CustomersModule,
    ProvidersModule,
    DriverGoModule,
    AdminModule,
    TasksModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    PinoLogger,
  ],
})
export class AppModule {}
