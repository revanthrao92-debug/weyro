import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

/**
 * NotificationQueue — BullMQ background queue for push notifications.
 *
 * STEP 4B: pushes are enqueued in-transaction (outbox pattern, already
 * implemented) and drained here — removing the push send from the request
 * path entirely. Retries with exponential backoff; failed jobs parked.
 *
 * Fallback: without REDIS_URL the queue is null — notifications fall back
 * to the inline send (the existing behaviour), so dev/test still work.
 */

export interface NotificationJobData {
  userId?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export const NOTIFICATION_QUEUE = 'weyro-notifications';

@Injectable()
export class NotificationQueue implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueue.name);
  private queue: Queue<NotificationJobData> | null = null;
  private worker: Worker<NotificationJobData> | null = null;
  private readonly handler?: (data: NotificationJobData) => Promise<void>;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    handler?: (data: NotificationJobData) => Promise<void>,
  ) {
    this.handler = handler;
    if (this.redis) {
      this.queue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE, {
        connection: this.redis,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      });

      this.worker = new Worker<NotificationJobData>(
        NOTIFICATION_QUEUE,
        async (job: Job<NotificationJobData>) => {
          if (this.handler) {
            await this.handler(job.data);
          }
        },
        { connection: this.redis },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.warn(
          `Notification job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`,
        );
      });

      this.worker.on('completed', (job) => {
        this.logger.log(`Notification job ${job.id} delivered`);
      });
    } else {
      this.logger.log('Redis not configured — notifications will send inline.');
    }
  }

  /** Enqueue a push notification. Falls back to inline send if no Redis. */
  async add(data: NotificationJobData): Promise<void> {
    if (this.queue) {
      await this.queue.add('push', data);
      return;
    }
    // Fallback: inline (no Redis in dev/test)
    if (this.handler) {
      await this.handler(data).catch(() => undefined);
    }
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
