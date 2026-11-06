import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdvisoryLockService } from '../../prisma/advisory-lock.service';
import { ExpiryCronService } from './expiry-cron.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { OutboxCronService } from './outbox-cron.service';

/**
 * STEP 2+7 — scheduled jobs. Imports PaymentsModule so PaymentReconcileService
 * resolves the PAYMENT_GATEWAY instance from the payment module's export.
 */
@Module({
  imports: [PaymentsModule, NotificationsModule],
  providers: [AdvisoryLockService, ExpiryCronService, PaymentReconcileService, OutboxCronService],
  exports: [AdvisoryLockService, PaymentReconcileService],
})
export class TasksModule {}
// — STEP 2+3: AdvisoryLockService registered here until it graduates to
// its own module (kept global across crons).
