import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
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
  controllers: [QuotationsController],
  providers: [QuotationsService, TrackingGateway],
  exports: [QuotationsService, TrackingGateway],
})
export class QuotationsModule {}
