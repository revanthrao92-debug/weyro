import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { TrackingGateway } from './tracking.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { env } from '../../config/env.config';

@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
    }),
    NotificationsModule,
    PaymentsModule,
  ],
  controllers: [QuotationsController, BookingsController],
  providers: [QuotationsService, BookingsService, TrackingGateway],
  exports: [QuotationsService, BookingsService, TrackingGateway],
})
export class QuotationsModule {}
