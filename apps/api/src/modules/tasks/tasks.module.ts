import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { ExpiryCronService } from './expiry-cron.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { OutboxCronService } from './outbox-cron.service';

/**
 * STEP 2+7 — scheduled jobs. Imports PaymentsModule so PaymentReconcileService
 * resolves the PAYMENT_GATEWAY instance from the payment module's export.
 */
@Module({
  imports: [PaymentsModule],
  providers: [ExpiryCronService, PaymentReconcileService, OutboxCronService],
  exports: [PaymentReconcileService],
})
export class TasksModule {}
