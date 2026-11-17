/**
 * Scheduled jobs across replicas, against a real database: the job lease lock
 * and the outbox drain must behave when several API instances share one DB.
 * Each `new AdvisoryLockService` / `new OutboxService` stands in for a replica.
 */

import { PrismaService } from '../prisma/prisma.service';
import { AdvisoryLockService } from '../prisma/advisory-lock.service';
import { OutboxService } from '../modules/notifications/outbox.service';

describe('Scheduled jobs across replicas (E2E)', () => {
  const suffix = `${Date.now()}`;
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.jobLock.deleteMany({ where: { name: { startsWith: `test-${suffix}` } } });
    await prisma.outboxEvent.deleteMany({ where: { type: { startsWith: `test.${suffix}` } } });
    await prisma.$disconnect();
  });

  describe('AdvisoryLockService (lease)', () => {
    it('lets only one replica hold a lock, and hands it over on release', async () => {
      const a = new AdvisoryLockService(prisma);
      const b = new AdvisoryLockService(prisma);
      const name = `test-${suffix}-one`;

      expect(await a.tryLock(name)).toBe(true);
      expect(await b.tryLock(name)).toBe(false);
      await a.release(name);
      expect(await b.tryLock(name)).toBe(true);
      await b.release(name);
    });

    it('takes over an expired lease, and the old holder cannot release the new one', async () => {
      const a = new AdvisoryLockService(prisma);
      const b = new AdvisoryLockService(prisma);
      const c = new AdvisoryLockService(prisma);
      const name = `test-${suffix}-expiry`;

      expect(await a.tryLock(name, 1)).toBe(true);
      await new Promise((r) => setTimeout(r, 20));
      expect(await b.tryLock(name)).toBe(true);

      await a.release(name); // stale holder: must leave b's lease alone
      expect(await c.tryLock(name)).toBe(false);
      await b.release(name);
    });

    it('acquires and releases reliably while other queries share the pool', async () => {
      // Regression: pg_advisory_lock/unlock landed on different pooled
      // connections, so releases silently failed and later runs were skipped.
      const lock = new AdvisoryLockService(prisma);
      const name = `test-${suffix}-pool`;
      let acquired = 0;
      for (let i = 0; i < 20; i += 1) {
        if (await lock.tryLock(name)) acquired += 1;
        const traffic = Array.from({ length: 6 }, () =>
          prisma.$queryRaw`SELECT 1 AS one`.then((x) => x),
        );
        await lock.release(name);
        await Promise.all(traffic);
      }
      expect(acquired).toBe(20);
    });
  });

  describe('OutboxService.drain', () => {
    it('delivers a backlog larger than one batch exactly once across concurrent replicas', async () => {
      const type = `test.${suffix}.fanout`;
      const total = 120;
      await prisma.outboxEvent.createMany({
        data: Array.from({ length: total }, (_, i) => ({ type, payload: { i } })),
      });

      const deliveries: string[] = [];
      const deliverer = async (event: { id: string; type: string }) => {
        await new Promise((r) => setTimeout(r, 2)); // let the replicas overlap
        if (event.type === type) deliveries.push(event.id);
      };
      const replicas = [
        new OutboxService(prisma, deliverer),
        new OutboxService(prisma, deliverer),
      ];

      await Promise.all(replicas.map((outbox) => outbox.drain(25)));

      expect(deliveries).toHaveLength(total);
      expect(new Set(deliveries).size).toBe(total);
      const unsent = await prisma.outboxEvent.count({ where: { type, sentAt: null } });
      expect(unsent).toBe(0);
    });

    it('schedules a failed event for retry instead of re-sending it in the same drain', async () => {
      const type = `test.${suffix}.failing`;
      const event = await prisma.outboxEvent.create({ data: { type, payload: {} } });

      let calls = 0;
      const outbox = new OutboxService(prisma, async (e) => {
        if (e.type === type) {
          calls += 1;
          throw new Error('push provider down');
        }
      });
      await outbox.drain(1);

      expect(calls).toBe(1);
      const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
      expect(row.attempts).toBe(1);
      expect(row.sentAt).toBeNull();
      expect(row.lastError).toBe('push provider down');
      expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
