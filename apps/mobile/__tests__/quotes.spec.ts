import { quoteMarkersFor } from '../src/utils/quotes';

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
});
