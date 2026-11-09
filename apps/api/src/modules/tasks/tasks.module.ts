import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdvisoryLockService } from '../../prisma/advisory-lock.service';
import { ExpiryCronService } from './expiry-cron.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { OutboxCronService } from './outbox-cron.service';

/**
 * STEP 2+3+7 — scheduled jobs.
 * - Imports PaymentsModule so PaymentReconcileService resolves
 *   PAYMENT_GATEWAY from the payments module's export.
 * - AdvisoryLockService gates all crons (replica-safe).
 * - OutboxCronService drains the transactional outbox.
 */
@Module({
  imports: [PaymentsModule, NotificationsModule],
  providers: [
    AdvisoryLockService,
    ExpiryCronService,
    PaymentReconcileService,
    OutboxCronService,
  ],
  exports: [AdvisoryLockService, PaymentReconcileService],
})
export class TasksModule {}
