import { Module } from '@nestjs/common';
import type Redis from 'ioredis';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OutboxService, OUTBOX_DELIVERER } from './outbox.service';
import { NotificationQueue } from '../../common/redis/notification.queue';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    OutboxService,
    {
      provide: NotificationQueue,
      useFactory: (redis: Redis | null, notifier: NotificationsService) =>
        new NotificationQueue(redis, async (data) => {
          await notifier.sendPushNotification({
            userId: data.userId ?? '',
            title: data.title,
            body: data.body,
            data: data.data,
          });
        }),
      inject: [REDIS_CLIENT, NotificationsService],
    },
    // Deliverer binding: the outbox will hand events back through the
    // NotificationsService (in-app copy + validated push fan-out).
    { provide: OUTBOX_DELIVERER, useExisting: NotificationsService },
  ],
  exports: [NotificationsService, OutboxService, NotificationQueue],
})
export class NotificationsModule {}

export { NotificationsService };