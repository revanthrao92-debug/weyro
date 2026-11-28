import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { promisify } from 'util';
import { gzip } from 'zlib';
import { scrubTrainingText, TRAINING_TEXT_CLEANER_VERSION } from '@weyro/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvisoryLockService } from '../../prisma/advisory-lock.service';
import { STORAGE_SERVICE, type StorageService } from '../uploads/interfaces/storage.interface';

const gzipAsync = promisify(gzip);
const LOCK = 'dataset';
const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
/** Text edited this recently is re-checked each night (a little over a day, so no gap between runs). */
const TEXT_WINDOW_MS = 26 * 3_600_000;
/** Most day files written in one run, so a long catch-up can't run for hours. */
const MAX_DAYS_PER_RUN = 60;
const CHUNK = 500;

type TextRow = { ref: string; field: string; text: string | null; data?: Record<string, unknown> };
type Recorded = { text: string; v: unknown; ids: string[]; days: Set<string> };
const V = TRAINING_TEXT_CLEANER_VERSION;
type EntityType = 'Request' | 'Quote' | 'Job' | 'DriverTrip' | 'Review';

/** India date (YYYY-MM-DD) of a moment, and the UTC instant that India day starts. */
export function indiaDay(at: Date): string {
  return new Date(at.getTime() + IST_MS).toISOString().slice(0, 10);
}
export function indiaDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - IST_MS);
}
export function datasetKey(day: string): string {
  const [y, m, d] = day.split('-');
  return `datasets/events/${y}/${m}/${d}.jsonl.gz`;
}

/**
 * Nightly AI-training dataset (docs/DATA.md):
 *  1. record cleaned text events for any new or edited free text (one place, so no save path is missed),
 *  2. write each finished India day of the event history to private storage as gzipped JSON lines.
 * Both steps are idempotent: re-running records nothing twice and never overwrites a day file.
 */
@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly advisoryLock: AdvisoryLockService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  // 02:30 India time, after the day is over.
  @Cron('30 21 * * *', { timeZone: 'UTC' })
  async nightly() {
    if (!(await this.advisoryLock.tryLock(LOCK))) return;
    try {
      const texts = await this.captureText();
      const days = await this.exportFinishedDays();
      this.logger.log(`Dataset: ${texts} text event(s) recorded, ${days.length} day file(s) written`);
    } catch (error) {
      this.logger.error(`Dataset run failed: ${(error as Error).message}`);
    } finally {
      await this.advisoryLock.release(LOCK);
    }
  }

  /**
   * Record cleaned text that is new or changed since it was last recorded. Keeps only the newest
   * cleaned copy per record and field. When the cleaner version changes, every stored text is
   * re-cleaned, older copies are removed, and the day files that held them are deleted so the
   * export writes them again without the old text. Returns how many text events were added.
   */
  async captureText(now = new Date()): Promise<number> {
    // Look at everything on the first run, or when any stored text came from an older cleaner.
    const [stale] = await this.prisma.$queryRaw<{ one: number }[]>`
      SELECT 1 AS one FROM "events" WHERE "type" = 'text' AND ("data"->>'v') IS DISTINCT FROM ${String(V)} LIMIT 1`;
    const any = await this.prisma.event.findFirst({ where: { type: 'text' }, select: { id: true } });
    const since = !any || stale ? new Date(0) : new Date(now.getTime() - TEXT_WINDOW_MS);
    const recent = { updatedAt: { gte: since } };
    const sources: [EntityType, () => Promise<TextRow[]>][] = [
      [
        'Request',
        async () =>
          (await this.prisma.serviceRequest.findMany({ where: recent, select: { ref: true, title: true, description: true } })).flatMap(
            (r) => [
              { ref: r.ref, field: 'title', text: r.title },
              { ref: r.ref, field: 'description', text: r.description },
            ],
          ),
      ],
      [
        'Quote',
        async () =>
          (await this.prisma.quotation.findMany({ where: recent, select: { ref: true, notes: true } })).map((q) => ({
            ref: q.ref,
            field: 'notes',
            text: q.notes,
          })),
      ],
      [
        'Job',
        async () =>
          // Parts jobs keep the delivery address in completionNotes (quotations.service accept), so they're left out.
          (
            await this.prisma.booking.findMany({
              where: { ...recent, quotation: { request: { category: { not: 'SPARE_PART' } } } },
              select: { ref: true, completionNotes: true },
            })
          ).map((b) => ({ ref: b.ref, field: 'completionNotes', text: b.completionNotes })),
      ],
      [
        'Review',
        async () =>
          (
            await this.prisma.review.findMany({
              where: recent,
              select: { comment: true, rating: true, booking: { select: { ref: true } } },
            })
          ).map((r) => ({ ref: r.booking.ref, field: 'review', text: r.comment, data: { rating: r.rating } })),
      ],
      [
        'DriverTrip',
        async () =>
          (await this.prisma.driverBooking.findMany({ where: recent, select: { ref: true, cancellationReason: true } })).map((t) => ({
            ref: t.ref,
            field: 'cancellationReason',
            text: t.cancellationReason,
          })),
      ],
    ];

    let added = 0;
    const staleDays = new Set<string>();
    for (const [entityType, load] of sources) {
      const rows = (await load())
        .map((row) => ({ ...row, text: scrubTrainingText(row.text) }))
        .filter((row): row is TextRow & { text: string } => Boolean(row.text));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const recorded = await this.recordedTexts(entityType, [...new Set(chunk.map((r) => r.ref))]);
        const fresh = chunk.filter((r) => {
          const prev = recorded.get(`${r.ref}|${r.field}`);
          return !prev || prev.text !== r.text || prev.v !== V;
        });
        if (!fresh.length) continue;
        // Older copies of these texts go; the days they were in get rewritten.
        const replaced = fresh.flatMap((r) => {
          const prev = recorded.get(`${r.ref}|${r.field}`);
          prev?.days.forEach((d) => staleDays.add(d));
          return prev?.ids ?? [];
        });
        await this.prisma.$transaction([
          this.prisma.event.deleteMany({ where: { id: { in: replaced }, type: 'text' } }),
          this.prisma.event.createMany({
            data: fresh.map((r) => ({
              type: 'text',
              entityType,
              entityRef: r.ref,
              data: { field: r.field, text: r.text, v: V, ...(r.data ?? {}) },
            })),
          }),
        ]);
        added += fresh.length;
      }
    }
    for (const day of staleDays) await this.storage.deletePrivateObject(datasetKey(day));
    return added;
  }

  /** Text already recorded per (ref, field): the newest copy, its cleaner version, and every copy's id and day. */
  private async recordedTexts(entityType: EntityType, refs: string[]): Promise<Map<string, Recorded>> {
    const events = await this.prisma.event.findMany({
      where: { type: 'text', entityType, entityRef: { in: refs } },
      orderBy: { seq: 'asc' },
      select: { id: true, entityRef: true, occurredAt: true, data: true },
    });
    const recorded = new Map<string, Recorded>();
    for (const e of events) {
      const d = e.data as { field?: string; text?: string; v?: unknown };
      if (!d.field || typeof d.text !== 'string') continue;
      const key = `${e.entityRef}|${d.field}`;
      const entry = recorded.get(key) ?? { text: d.text, v: d.v, ids: [], days: new Set<string>() };
      entry.text = d.text;
      entry.v = d.v;
      entry.ids.push(e.id);
      entry.days.add(indiaDay(e.occurredAt));
      recorded.set(key, entry);
    }
    return recorded;
  }

  /** Write every finished India day that has events but no file yet (oldest first). Returns the days written. */
  async exportFinishedDays(now = new Date()): Promise<string[]> {
    const first = await this.prisma.event.findFirst({ orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } });
    if (!first) return [];
    const today = indiaDay(now);
    const written: string[] = [];
    for (let day = indiaDay(first.occurredAt); day < today && written.length < MAX_DAYS_PER_RUN; ) {
      if (!(await this.storage.objectExists(datasetKey(day)))) {
        const count = await this.exportDay(day);
        if (count > 0) written.push(day);
      }
      day = indiaDay(new Date(indiaDayStart(day).getTime() + DAY_MS));
    }
    return written;
  }

  /** One India day of events as gzipped JSON lines. Returns the number of events written (0 = no file). */
  async exportDay(day: string): Promise<number> {
    const start = indiaDayStart(day);
    const events = await this.prisma.event.findMany({
      where: { occurredAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) } },
      orderBy: { seq: 'asc' },
      select: {
        seq: true,
        occurredAt: true,
        type: true,
        entityType: true,
        entityRef: true,
        fromStatus: true,
        toStatus: true,
        source: true,
        data: true,
      },
    });
    if (events.length === 0) return 0;
    const lines = events.map((e) => JSON.stringify({ ...e, seq: Number(e.seq), occurredAt: e.occurredAt.toISOString() })).join('\n');
    await this.storage.putPrivateObject({
      key: datasetKey(day),
      body: await gzipAsync(Buffer.from(`${lines}\n`, 'utf8')),
      contentType: 'application/x-ndjson',
      contentEncoding: 'gzip',
    });
    return events.length;
  }
}
