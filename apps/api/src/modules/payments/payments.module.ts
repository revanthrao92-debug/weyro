import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentGateway, PAYMENT_GATEWAY } from './interfaces/payment-gateway.interface';
import { RazorpayPaymentGateway } from './gateways/razorpay.gateway';
import { MockPaymentGateway } from './gateways/mock.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { env } from '../../config/env.config';

export function selectedGateway(): 'razorpay' | 'mock' {
  if (env.PAYMENT_GATEWAY) return env.PAYMENT_GATEWAY;
  return env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? 'razorpay' : 'mock';
}

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_GATEWAY,
      useClass:
        selectedGateway() === 'razorpay'
          ? RazorpayPaymentGateway
          : MockPaymentGateway,
    },
  ],
  exports: [PaymentsService, PAYMENT_GATEWAY],
})
export class PaymentsModule {}
export type { PaymentGateway };
