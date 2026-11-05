import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { OutboxService } from '../notifications/outbox.service';

/**
 * STEP 5 — Outbox worker. Every minute (bounded batch):
 * drains due outbox rows through the NotificationsService deliverer.
 * Sent stamps + retry backoff live inside OutboxService.drain itself.
 */
@Injectable()
export class OutboxCronService {
  private readonly logger = new Logger(OutboxCronService.name);

  constructor(
    private readonly outbox: OutboxService,
    @Inject(NotificationsService)
    private readonly notifications?: NotificationsService,
  ) {
    if (this.outbox && this.notifications) {
      // Register the notifications module's deliverer so the outbox can hop
      // straight to a validated pipeline (in-app copy + push fan-out).
      const deliverer = this.notifications.deliverOutboxRow;
      this.outbox.registerDeliverer((event) =>
        deliverer.call(this.notifications, event),
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async drain(): Promise<void> {
    if (!this.outbox) return;
    try {
      const delivered = await this.outbox.drain(25);
      if (delivered > 0) {
        this.logger.log(`Outbox drained: ${delivered} event(s) delivered`);
      }
    } catch (err: any) {
      this.logger.error(`Outbox drain errored: ${err?.message ?? err}`);
    }
  }
}
