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

/** How long a claimed event stays invisible to other drains while it is delivered. */
const CLAIM_LEASE = '5 minutes';

type ClaimedEvent = {
  id: string;
  type: string;
  channel: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

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

  /**
   * Drain due events (called by the Tasks cron). Claims batches until none are
   * due or `budgetMs` has passed, so a backlog clears in one run instead of
   * one batch per minute. Safe to run on every replica at once (see `claim`).
   */
  async drain(batchSize = 50, budgetMs = 8_000): Promise<number> {
    if (!this.deliverer) {
      this.logger.warn('Outbox drain skipped — no deliverer registered yet.');
      return 0;
    }

    const deadline = Date.now() + budgetMs;
    let delivered = 0;
    while (Date.now() < deadline) {
      const batch = await this.claim(batchSize);
      const results = await Promise.all(batch.map((event) => this.deliverOne(event)));
      delivered += results.filter(Boolean).length;
      if (batch.length < batchSize) break;
    }
    return delivered;
  }

  /**
   * Atomically claim up to `limit` due events. `FOR UPDATE SKIP LOCKED` keeps
   * concurrent replicas off the same rows, and pushing `nextAttemptAt` forward
   * leases them: if this process dies mid-delivery, they become due again after
   * CLAIM_LEASE and are retried (at-least-once delivery).
   */
  private claim(limit: number): Promise<ClaimedEvent[]> {
    // nextAttemptAt is TIMESTAMP (no zone) holding UTC, as Prisma writes it.
    return this.prisma.$queryRaw<ClaimedEvent[]>`
      UPDATE "outbox_events"
      SET "nextAttemptAt" = (now() AT TIME ZONE 'UTC') + ${CLAIM_LEASE}::interval
      WHERE "id" IN (
        SELECT "id" FROM "outbox_events"
        WHERE "sentAt" IS NULL AND "failedAt" IS NULL
          AND "nextAttemptAt" <= (now() AT TIME ZONE 'UTC')
        ORDER BY "nextAttemptAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "type", "channel", "payload", "attempts", "maxAttempts"
    `;
  }

  /** Deliver one claimed event; on failure schedule a retry with backoff. Returns true if sent. */
  private async deliverOne(event: ClaimedEvent): Promise<boolean> {
    try {
      await this.deliverer!(event);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { sentAt: new Date() },
      });
      return true;
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
      return false;
    }
  }
}
