/**
 * Day, week and month boundaries on the Indian calendar. The server runs in
 * UTC, so a plain `setHours(0, 0, 0, 0)` starts "today" at 05:30 IST and a
 * 1 am sale lands on the previous day.
 */
const IST_OFFSET_MS = 330 * 60_000;

const local = (now: Date) => new Date(now.getTime() + IST_OFFSET_MS);

/** Midnight IST at the start of `now`'s Indian day, as a real instant. */
export function istDayStart(now: Date = new Date()): Date {
  const l = local(now);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - IST_OFFSET_MS);
}

/** Midnight IST on the Sunday that starts `now`'s week (same Sunday start as before). */
export function istWeekStart(now: Date = new Date()): Date {
  return new Date(istDayStart(now).getTime() - local(now).getUTCDay() * 24 * 60 * 60_000);
}

/** Midnight IST on the 1st of `now`'s Indian month. */
export function istMonthStart(now: Date = new Date()): Date {
  const l = local(now);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - IST_OFFSET_MS);
}
