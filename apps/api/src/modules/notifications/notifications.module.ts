import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OutboxService, OUTBOX_DELIVERER } from './outbox.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    OutboxService,
    // Deliverer binding: the outbox will hand events back through the
    // NotificationsService (in-app copy + validated push fan-out).
    { provide: OUTBOX_DELIVERER, useExisting: NotificationsService },
  ],
  exports: [NotificationsService, OutboxService],
})
export class NotificationsModule {}

export { NotificationsService };