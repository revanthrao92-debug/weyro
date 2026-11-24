import { compactRupees, monotonePath, nearestIndex, niceMax } from '@/utils/earningsChart';

describe('earnings chart geometry', () => {
  it('never overshoots below the lowest point (no dip under ₹0)', () => {
    const d = monotonePath([
      { x: 0, y: 100 },
      { x: 10, y: 100 },
      { x: 20, y: 0 },
      { x: 30, y: 100 },
      { x: 40, y: 100 },
    ]);
    const ys = [...d.matchAll(/[-\d.]+,([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it('handles empty and single-point input', () => {
    expect(monotonePath([])).toBe('');
    expect(monotonePath([{ x: 5, y: 7 }])).toBe('M5,7');
  });

  it('rounds the axis top up to a clean number', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(13394)).toBe(20000);
    expect(niceMax(24000)).toBe(25000);
    expect(niceMax(50000)).toBe(50000);
  });

  it('snaps a touch to the nearest day', () => {
    expect(nearestIndex(0, 300, 31)).toBe(0);
    expect(nearestIndex(300, 300, 31)).toBe(30);
    expect(nearestIndex(151, 300, 31)).toBe(15);
    expect(nearestIndex(-20, 300, 31)).toBe(0);
    expect(nearestIndex(999, 300, 31)).toBe(30);
  });

  it('shortens rupee labels', () => {
    expect(compactRupees(850)).toBe('₹850');
    expect(compactRupees(1250)).toBe('₹1.3k');
    expect(compactRupees(24000)).toBe('₹24k');
    expect(compactRupees(240000)).toBe('₹2.4L');
  });
});
