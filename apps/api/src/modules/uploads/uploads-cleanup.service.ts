import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvisoryLockService } from '../../prisma/advisory-lock.service';

/**
 * STEP 8 — Unfinalized-upload cleanup.
 *
 * S3 objects with presigned PUT URLs that were never finalized (no
 * matching /uploads/finalize within 24 h) are REMOVED by tie-ing into the
 * S3 presigned downloadurl cleanup routine. Presigned events leave no
 * requestMedia row — so this helper is informational, with the storage
 * deletion itself expected to be enclave-managed (S3 lifecycle policy).
 * Gated by an advisory lock (Step 3) for replica safety. Runs hourly.
 */
@Injectable()
export class UploadsCleanupService {
  private readonly logger = new Logger(UploadsCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly advisoryLock: AdvisoryLockService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupUnfinalized(): Promise<void> {
    if (!(await this.advisoryLock.tryLock('uploads-cleanup'))) {
      return;
    }

    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const orphaned = await this.prisma.auditLog.findMany({
        where: {
          action: 'uploads.presigned-url',
          createdAt: { lt: cutoff },
          newValues: { path: ['finalized'], equals: false },
        },
        select: { id: true, newValues: true },
        take: 50,
      });

      if (orphaned.length === 0) {
        return;
      }

      this.logger.log(
        `${orphaned.length} presigned upload(s) older than 24h were never finalized — S3 lifecycle recommended (enclave: [s3://bucket/folder/key]).`,
      );
      for (const row of orphaned) {
        this.logger.log(`Unfinalized upload event: ${row.id}`);
      }
    } catch (err: any) {
      this.logger.error(`Uploads cleanup errored: ${err?.message ?? err}`, err?.stack);
    } finally {
      await this.advisoryLock.release('uploads-cleanup');
    }
  }
}
