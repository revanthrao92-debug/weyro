import { durationLabel, quoteMarkersFor, readyBy, sortQuotes } from '../src/utils/quotes';

const q = (id: string, totalCost: number, avgRating?: number) => ({ id, totalCost, provider: { avgRating } });

describe('quoteMarkersFor', () => {
  it('marks nothing for a single quote', () => {
    expect(quoteMarkersFor([q('a', 1000, 4.5)])).toEqual({});
  });

  it('marks the cheapest and the best-rated separately', () => {
    expect(quoteMarkersFor([q('a', 1500, 4.9), q('b', 900, 4.1), q('c', 1200, 3.8)])).toEqual({
      b: 'Cheapest',
      a: 'Best rated',
    });
  });

  it('combines both on one quote, and skips "best rated" when nobody has a rating', () => {
    expect(quoteMarkersFor([q('a', 800, 4.8), q('b', 900, 4.0)])).toEqual({ a: 'Cheapest and best rated' });
    expect(quoteMarkersFor([q('a', 800), q('b', 900)])).toEqual({ a: 'Cheapest' });
  });

  it('ignores quotes that can no longer be accepted', () => {
    const expired = { ...q('x', 100, 5), status: 'EXPIRED' };
    expect(quoteMarkersFor([expired, { ...q('a', 900, 4), status: 'PENDING' }, { ...q('b', 1200, 4.5), status: 'PENDING' }])).toEqual({
      a: 'Cheapest',
      b: 'Best rated',
    });
  });

  it('compares string amounts from the API as numbers', () => {
    expect(quoteMarkersFor([q('a', '1500' as unknown as number), q('b', '999' as unknown as number)])).toEqual({ b: 'Cheapest' });
  });

  it('adds "Ready soonest" when at least two quotes give a time', () => {
    const t = (id: string, cost: number, startsAt: string, durationHours: number) => ({ id, totalCost: cost, startsAt, durationHours });
    expect(
      quoteMarkersFor([t('a', 900, '2026-11-26T04:00:00Z', 48), t('b', 1200, '2026-11-26T04:00:00Z', 4)]),
    ).toEqual({ a: 'Cheapest', b: 'Ready soonest' });
    expect(quoteMarkersFor([t('a', 900, '2026-11-26T04:00:00Z', 4), t('b', 1200, '2026-11-27T04:00:00Z', 4)])).toEqual({
      a: 'Cheapest and ready soonest',
    });
  });
});

describe('quote time and sorting', () => {
  const q = (id: string, totalCost: number, startsAt: string | null, durationHours: number | null, avgRating = 0) => ({
    id,
    totalCost,
    startsAt,
    durationHours,
    provider: { avgRating },
  });
  const a = q('a', 1500, '2026-11-26T04:00:00Z', 4, 4.9); // ready 26 Nov 08:00 UTC
  const b = q('b', 900, '2026-11-27T04:00:00Z', 48, 4.1); // ready 29 Nov
  const c = q('c', 1100, null, null, 3.8); // old free-text quote

  it('works out ready-by from start + duration, and nothing for old quotes', () => {
    expect(readyBy(a)?.toISOString()).toBe('2026-11-26T08:00:00.000Z');
    expect(readyBy(c)).toBeNull();
  });

  it('sorts by cheapest, soonest (old quotes last) and best rated', () => {
    expect(sortQuotes([a, b, c], 'cheapest').map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(sortQuotes([c, b, a], 'soonest').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(sortQuotes([b, c, a], 'rated').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('labels durations plainly', () => {
    expect(durationLabel(2)).toBe('2 hours');
    expect(durationLabel(24)).toBe('1 day');
    expect(durationLabel(72)).toBe('3 days');
    expect(durationLabel(168)).toBe('1 week');
  });
});
