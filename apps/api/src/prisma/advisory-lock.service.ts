import { randomUUID } from 'crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Cross-replica lock for scheduled jobs, so a job runs on one API replica at a time.
 *
 * A lease row in `job_locks`, not `pg_advisory_lock`: session advisory locks
 * belong to one connection, and with a connection pool (or PgBouncer) the
 * unlock can run on a different connection, leaving the lock held. Every
 * operation here is a single statement, so pooling can't split it.
 *
 * A holder that crashes stops renewing; its lease expires after `ttlMs` and
 * another replica takes over. Keep `ttlMs` above the job's worst-case runtime.
 *
 * Usage:
 *   if (!(await locks.tryLock('payments-reconcile'))) return;
 *   try { … } finally { await locks.release('payments-reconcile'); }
 */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AdvisoryLockService implements OnModuleDestroy {
  /** Lock name → owner token of the lease this instance holds. */
  private readonly held = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.held.keys()].map((name) => this.release(name).catch(() => undefined)),
    );
  }

  /** Try to take the named lease. Non-blocking: false if another holder's lease is live. */
  async tryLock(name: string, ttlMs = DEFAULT_TTL_MS): Promise<boolean> {
    const owner = randomUUID();
    const expiresAt = new Date(Date.now() + ttlMs);

    // First run of this job: create the row (ON CONFLICT DO NOTHING).
    const created = await this.prisma.jobLock.createMany({
      data: [{ name, owner, expiresAt }],
      skipDuplicates: true,
    });
    if (created.count === 0) {
      // Row exists: take it over only if the previous lease has expired.
      // Compare-and-set, so two replicas can't both win.
      const taken = await this.prisma.jobLock.updateMany({
        where: { name, expiresAt: { lt: new Date() } },
        data: { owner, expiresAt },
      });
      if (taken.count === 0) return false;
    }

    this.held.set(name, owner);
    return true;
  }

  /** Release a lease this instance holds; a lease taken over by another replica is left alone. */
  async release(name: string): Promise<void> {
    const owner = this.held.get(name);
    this.held.delete(name);
    if (!owner) return;
    await this.prisma.jobLock.deleteMany({ where: { name, owner } });
  }
}
