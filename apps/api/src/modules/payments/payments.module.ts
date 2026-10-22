import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_GATEWAY } from './interfaces/payment-gateway.interface';
import { RazorpayPaymentGateway } from './gateways/razorpay.gateway';
import { MockPaymentGateway } from './gateways/mock.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { env } from '../../config/env.config';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_GATEWAY,
      useClass:
        env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
          ? RazorpayPaymentGateway
          : MockPaymentGateway,
    },
  ],
  exports: [PaymentsService, PAYMENT_GATEWAY],
})
export class PaymentsModule {}
