import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { PAYMENT_GATEWAY, PaymentGateway } from '../payments/interfaces/payment-gateway.interface';

import { ExpiryCronService } from './expiry-cron.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { OutboxCronService } from './outbox-cron.service';

@Module({
  imports: [PaymentsModule],
  providers: [
    ExpiryCronService,
    PaymentReconcileService,
    OutboxCronService,
    { provide: PAYMENT_GATEWAY, inject: [PAYMENT_GATEWAY], useFactory: (gw: PaymentGateway) => gw },
  ],
  exports: [PaymentReconcileService],
})
export class TasksModule {}
