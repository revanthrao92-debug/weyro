import type { DailyBucket } from './analytics';
import { backtest, fitModel, forecastEarnings, type ForecastInput } from './forecast';
import type { Festival } from './india-festivals';

const NO_FESTIVALS: Festival[] = [];

/** `n` complete days ending 2026-11-24 (a Tuesday), sales from `perDay(date, index)`. */
function history(n: number, perDay: (date: string, i: number) => number, refundShare = 0): DailyBucket[] {
  const end = Date.parse('2026-11-24T00:00:00Z');
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(end - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const gross = perDay(date, i);
    const refunds = gross * refundShare;
    return { date, gross, refunds, net: gross - refunds, orders: gross > 0 ? 1 : 0 };
  });
}
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

function input(over: Partial<ForecastInput> = {}): ForecastInput {
  return {
    history: history(84, () => 1000),
    shopOpen: true,
    parts: [],
    quotes: { pendingTotal: 0, pendingCount: 0, accepted: 0, decided: 0 },
    demand: { last7: 0, previous56: 0 },
    festivals: NO_FESTIVALS,
    ...over,
  };
}
const ok = (f: ReturnType<typeof forecastEarnings>) => {
  if (!f.available) throw new Error(f.reason);
  return f;
};
const factor = (f: ReturnType<typeof ok>, key: string) => f.factors.find((x) => x.key === key);

describe('forecastEarnings', () => {
  it('refuses with too few orders or too little history', () => {
    expect(forecastEarnings(input({ history: history(30, (_, i) => (i < 3 ? 500 : 0)) })).available).toBe(false);
    expect(forecastEarnings(input({ history: history(10, () => 500) })).available).toBe(false);
  });

  it('ignores the empty days before the first sale', () => {
    const h = history(120, (_, i) => (i < 60 ? 0 : 1000));
    expect(fitModel(h, NO_FESTIVALS)?.days).toBe(60);
  });

  it('forecasts steady sales as steady, with a range around them', () => {
    const f = ok(forecastEarnings(input()));
    expect(f.points).toHaveLength(14);
    expect(f.points[0].date).toBe('2026-11-25');
    expect(f.projectedTotal).toBeCloseTo(14000, -2);
    expect(f.trend).toBe('FLAT');
    expect(f.projectedLow).toBeLessThanOrEqual(f.projectedTotal);
    expect(f.projectedHigh).toBeGreaterThanOrEqual(f.projectedTotal);
  });

  it('learns a growth trend', () => {
    const f = ok(forecastEarnings(input({ history: history(84, (_, i) => 500 + i * 20) })));
    expect(f.trend).toBe('UP');
    expect(factor(f, 'trend')!.amount).toBeGreaterThan(0);
    expect(f.points[13].value).toBeGreaterThan(f.points[0].value);
  });

  it('learns that Sundays are slow, and says so', () => {
    const f = ok(forecastEarnings(input({ history: history(84, (d) => (dow(d) === 0 ? 300 : 1000)) })));
    const sunday = f.points.find((p) => dow(p.date) === 0)!;
    const monday = f.points.find((p) => dow(p.date) === 1)!;
    expect(sunday.value).toBeLessThan(monday.value * 0.5);
    expect(factor(f, 'weekday')!.detail).toContain('Sundays');
  });

  it('skips the weekday effect with under 4 weeks of sales, and says why', () => {
    const f = ok(forecastEarnings(input({ history: history(20, () => 1000) })));
    expect(factor(f, 'weekday')).toBeUndefined();
    expect(f.skipped.find((s) => s.key === 'weekday')!.reason).toContain('20 days');
  });

  it('finds no weekday effect in pure noise', () => {
    const noisy = history(84, (_, i) => 1000 + ((i * 7919) % 400) - 200);
    const f = ok(forecastEarnings(input({ history: noisy })));
    expect(factor(f, 'weekday')).toBeUndefined();
    expect(f.skipped.find((s) => s.key === 'weekday')!.reason).toContain('stands out');
  });

  it('takes off sales a part cannot make once it runs out', () => {
    // 1 a day at ₹1,000, 4 left: about 10 of 14 days are lost.
    const f = ok(
      forecastEarnings(input({ parts: [{ name: 'Front Bumper', price: 1000, stock: 4, unitsLast28: 28 }] })),
    );
    const stock = factor(f, 'stock')!;
    expect(stock.amount).toBeCloseTo(-10000, -2);
    expect(stock.detail).toContain('Front Bumper may run out in about 4 days');
  });

  it('adds waiting quotes at the usual win rate, only with enough answered quotes', () => {
    const quotes = { pendingTotal: 10000, pendingCount: 2, accepted: 4, decided: 10 };
    const f = ok(forecastEarnings(input({ quotes })));
    expect(factor(f, 'quotes')!.amount).toBeCloseTo(4000, 0);
    const few = ok(forecastEarnings(input({ quotes: { ...quotes, decided: 3, accepted: 1 } })));
    expect(factor(few, 'quotes')).toBeUndefined();
  });

  it('raises the forecast when nearby demand is above usual, within limits', () => {
    const f = ok(forecastEarnings(input({ demand: { last7: 40, previous56: 80 } })));
    const demand = factor(f, 'demand')!;
    expect(demand.amount).toBeGreaterThan(0);
    expect(demand.amount).toBeLessThan(14000 * 0.25); // capped at +25%, fading
  });

  it('takes off the usual refund share', () => {
    const f = ok(forecastEarnings(input({ history: history(84, () => 1000, 0.1) })));
    expect(factor(f, 'refunds')!.detail).toContain('10%');
    expect(f.projectedTotal).toBeCloseTo(12600, -2);
  });

  it('marks festival days quieter and the days before busier', () => {
    const diwali: Festival = { date: '2026-12-01', name: 'Diwali', closes: true, buildUpDays: 3 };
    const f = ok(forecastEarnings(input({ festivals: [diwali] })));
    const on = f.points.find((p) => p.date === '2026-12-01')!;
    const before = f.points.find((p) => p.date === '2026-11-30')!;
    const plain = f.points.find((p) => p.date === '2026-11-26')!;
    expect(on.value).toBeLessThan(plain.value);
    expect(before.value).toBeGreaterThan(plain.value);
    expect(factor(f, 'festivals')!.detail).toContain('Diwali');
  });

  it('forecasts zero while the shop is switched off', () => {
    const f = ok(forecastEarnings(input({ shopOpen: false })));
    expect(f.projectedTotal).toBe(0);
    expect(f.points.every((p) => p.value === 0 && p.high === 0)).toBe(true);
    expect(factor(f, 'closed')!.amount).toBeLessThan(-10000);
  });

  it('measures its own accuracy by replaying past weeks', () => {
    const noisy = history(120, (_, i) => 1000 + ((i * 7919) % 400) - 200);
    expect(backtest(noisy, 14, NO_FESTIVALS).length).toBeGreaterThanOrEqual(3);
    const f = ok(forecastEarnings(input({ history: noisy })));
    expect(f.accuracy).not.toBeNull();
    expect(f.accuracy!.withinPct).toBeLessThan(15);
  });

  it('never forecasts below zero, even for a falling shop', () => {
    const f = ok(forecastEarnings(input({ history: history(60, (_, i) => Math.max(0, 3000 - i * 60)) })));
    expect(f.points.every((p) => p.value >= 0 && p.low >= 0)).toBe(true);
  });
});
