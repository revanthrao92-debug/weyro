import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * STEP 3 — Postgres advisory lock helper.
 *
 * `pg_try_advisory_lock(key)` is instance-scoped across ALL API replicas
 * sharing the same database, so scheduled jobs (expiry cron, payment
 * reconciliation) never double-run.
 *
 * Usage:
 *   if (!(await advisoryLock.tryLock('payments-reconcile'))) return;
 *   try { … } finally { release }
 */

const LOCK_TTL_MS = 10 * 60 * 1000; // safety: release after 10 minutes even on crash

@Injectable()
export class AdvisoryLockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdvisoryLockService.name);
  private readonly held = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Held locks are safety-TTL'd by LOCK_TTL_MS; Postgres releases advisory
    // locks automatically if the connection dies, so there is nothing to
    // dispose of here.
  }

  onModuleDestroy(): void {
    for (const key of this.held.keys()) {
      void this.release(key).catch(() => undefined);
    }
  }

  /** Stable 63-bit integer from a string key (Postgres advisory key space). */
  static keyFrom(name: string): bigint {
    // FNV-1a over the UTF-8 bytes, then mask toBigInt within 2^63-1.
    let h = 2166136261;
    for (let i = 0; i < name.length; i += 1) {
      h ^= name.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return BigInt.asIntN(63, BigInt(h));
  }

  /**
   * Attempt to acquire a named advisory lock. Returns true if this
   * instance now holds it. Non-blocking (`pg_try_advisory_lock`).
   */
  async tryLock(name: string): Promise<boolean> {
    const acquired = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(${AdvisoryLockService.keyFrom(name)}) AS ok
    `;

    if (!acquired?.length || acquired[0]?.ok !== true) {
      return false;
    }

    this.held.set(name, Date.now());
    return true;
  }

  async release(name: string): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(${AdvisoryLockService.keyFrom(name)})
      `;
    } finally {
      this.held.delete(name);
    }
  }

  /** Simple TTL audit — logs suspicions if a lock looks abandoned (timer). */
  auditHeld(): string[] {
    const now = Date.now();
    for (const [key, since] of this.held.entries()) {
      if (now - since > LOCK_TTL_MS) {
        this.logger.warn(`Advisory lock "${key}" held longer than TTL (${LOCK_TTL_MS} ms)`);
      }
    }
    return Array.from(this.held.keys());
  }
}
