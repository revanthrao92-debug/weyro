type MarkerQuote = {
  id: string;
  totalCost: number | string;
  status?: string;
  startsAt?: string | null;
  durationHours?: number | null;
  provider?: { avgRating?: number | null } | null;
};

const HOUR_MS = 3_600_000;

/** When the job should be done: start + how long it takes. Null for older free-text quotes. */
export function readyBy(quote: { startsAt?: string | null; durationHours?: number | null }): Date | null {
  if (!quote.startsAt || !quote.durationHours) return null;
  const start = new Date(quote.startsAt).getTime();
  return Number.isNaN(start) ? null : new Date(start + quote.durationHours * HOUR_MS);
}

/** "Thu, 28 Nov" in the phone's time zone. */
export function shortDay(date: Date): string {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "4 hours", "1 day", "1 week". */
export function durationLabel(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return days === 7 ? '1 week' : `${days} day${days === 1 ? '' : 's'}`;
}

/** "Starts Tue, 26 Nov, takes about 2 days. Ready by Thu, 28 Nov", or the old free text. */
export function quoteTimeText(quote: {
  startsAt?: string | null;
  durationHours?: number | null;
  etaDescription?: string | null;
}): string | null {
  const ready = readyBy(quote);
  if (!ready || !quote.startsAt || !quote.durationHours) return quote.etaDescription || null;
  return `Starts ${shortDay(new Date(quote.startsAt))}, takes about ${durationLabel(quote.durationHours)}. Ready by ${shortDay(ready)}`;
}

/** "5 more days" / "18 more hours" / "40 more minutes" until quotes close; null once closed. */
export function timeLeft(until: string | null | undefined, now: number): string | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - now;
  if (!(ms > 0)) return null;
  const hours = Math.floor(ms / HOUR_MS);
  if (hours >= 48) return `${Math.floor(hours / 24)} more days`;
  if (hours >= 1) return `${hours} more hour${hours === 1 ? '' : 's'}`;
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return `${minutes} more minute${minutes === 1 ? '' : 's'}`;
}

export type QuoteSort = 'cheapest' | 'soonest' | 'rated';

/** Sorted copy. Quotes without a ready-by date go last on "soonest"; ties fall back to price. */
export function sortQuotes<T extends MarkerQuote>(quotes: T[], by: QuoteSort): T[] {
  const price = (q: T) => Number(q.totalCost);
  const ready = (q: T) => readyBy(q)?.getTime() ?? Number.POSITIVE_INFINITY;
  const rating = (q: T) => q.provider?.avgRating ?? 0;
  return [...quotes].sort((a, b) => {
    if (by === 'soonest') return ready(a) - ready(b) || price(a) - price(b);
    if (by === 'rated') return rating(b) - rating(a) || price(a) - price(b);
    return price(a) - price(b);
  });
}

/**
 * "Cheapest" / "Best rated" / "Ready soonest" labels by quote id, only when there's more than one
 * quote to compare. One quote winning several reads "Cheapest and ready soonest".
 */
export function quoteMarkersFor(all: MarkerQuote[]): Record<string, string> {
  // Only quotes the customer can still accept compete.
  const quotes = all.filter((q) => !q.status || q.status === 'PENDING');
  if (quotes.length < 2) return {};
  const labels: Record<string, string[]> = {};
  const add = (id: string, label: string) => (labels[id] ??= []).push(label);

  const cheapest = quotes.reduce((a, b) => (Number(b.totalCost) < Number(a.totalCost) ? b : a));
  add(cheapest.id, 'Cheapest');
  const rated = quotes.reduce((a, b) => ((b.provider?.avgRating ?? 0) > (a.provider?.avgRating ?? 0) ? b : a));
  if ((rated.provider?.avgRating ?? 0) > 0) add(rated.id, 'Best rated');
  const timed = quotes.filter((q) => readyBy(q));
  if (timed.length >= 2) {
    const soonest = timed.reduce((a, b) => (readyBy(b)!.getTime() < readyBy(a)!.getTime() ? b : a));
    add(soonest.id, 'Ready soonest');
  }

  const out: Record<string, string> = {};
  for (const [id, list] of Object.entries(labels)) {
    const [first, ...rest] = list.map((l, i) => (i === 0 ? l : l.toLowerCase()));
    out[id] = rest.length === 0 ? first : `${[first, ...rest.slice(0, -1)].join(', ')} and ${rest[rest.length - 1]}`;
  }
  return out;
}
