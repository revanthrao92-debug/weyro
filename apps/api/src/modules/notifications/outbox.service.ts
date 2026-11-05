import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * STEP 5 — Transactional outbox (writer + drain).
 *
 * Writer: `enqueue(tx, type, payload)` MUST run inside the SAME transaction
 * as the business change — a rolled-back tx deletes the enqueued row, so
 * notifications can never fire for work that did not happen.
 *
 * Drain: NotificationService registers itself as the deliverer
 * (`registerDeliverer`). The cron worker path (TasksModule) drains with the
 * registered handler — keeping the outbox decoupled from push internals.
 */

export type OutboxPayload = {
  userId?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OutboxDeliverer = (
  event: { id: string; type: string; channel: string; payload: unknown },
) => Promise<void>;

export const OUTBOX_DELIVERER = 'OUTBOX_DELIVERER';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private deliverer?: OutboxDeliverer;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(OUTBOX_DELIVERER) deliverer?: OutboxDeliverer,
  ) {
    if (deliverer) {
      this.registerDeliverer(deliverer);
    }
  }

  registerDeliverer(fn: OutboxDeliverer): void {
    this.deliverer = fn;
  }

  /** Write an outbox row inside the caller's transaction. */
  async enqueue(
    tx: Prisma.TransactionClient,
    type: string,
    payload: OutboxPayload,
    channel = 'expo-push',
    maxAttempts = 5,
  ): Promise<string> {
    const row = await tx.outboxEvent.create({
      data: {
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
        channel,
        maxAttempts,
      },
    });
    return row.id;
  }

  /** Drain due events (called by the Tasks cron). */
  async drain(limit = 25): Promise<number> {
    const now = new Date();

    const due = await this.prisma.outboxEvent.findMany({
      where: {
        sentAt: null,
        failedAt: null,
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });

    if (due.length === 0) {
      return 0;
    }

    if (!this.deliverer) {
      this.logger.warn('Outbox drain skipped — no deliverer registered yet.');
      return 0;
    }

    let delivered = 0;
    for (const event of due) {
      try {
        await this.deliverer(event);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { sentAt: new Date() },
        });
        delivered += 1;
      } catch (err: any) {
        const attempts = event.attempts + 1;
        const terminal = attempts >= event.maxAttempts;
        const backoffMs = 30_000 * 2 ** Math.min(5, attempts - 1); // 30s…480s
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts,
            lastError: String(err?.message ?? err),
            ...(terminal
              ? { failedAt: new Date() }
              : { nextAttemptAt: new Date(Date.now() + backoffMs) }),
          },
        });
        this.logger.warn(
          `Outbox ${event.id} (${event.type}) attempt ${attempts}/${event.maxAttempts} failed: ${err?.message ?? err}`,
        );
      }
    }

    return delivered;
  }
}
