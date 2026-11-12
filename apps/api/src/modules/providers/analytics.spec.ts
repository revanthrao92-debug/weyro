import {
  addDays,
  buildDailyBuckets,
  forecastNetSales,
  startOfDayUTC,
  summariseAnalytics,
} from './analytics';

const now = new Date('2026-11-12T10:00:00.000Z');

function daysAgo(days: number, hour = 10) {
  const date = addDays(startOfDayUTC(now), -days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function order(amount: number, paidDaysAgo: number, refundedDaysAgo?: number) {
  return {
    totalAmount: amount,
    paidAt: daysAgo(paidDaysAgo),
    refundedAt:
      refundedDaysAgo === undefined ? null : daysAgo(refundedDaysAgo),
    status: refundedDaysAgo === undefined ? 'PAID' : 'REFUNDED',
  };
}

describe('analytics', () => {
  it('builds one bucket per day and nets refunds', () => {
    const buckets = buildDailyBuckets(
      [order(1000, 2), order(500, 2, 1), order(250, 0)],
      3,
      now,
    );

    expect(buckets).toHaveLength(3);
    expect(buckets.map((bucket) => bucket.date)).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
    expect(buckets[0]).toMatchObject({ gross: 1500, refunds: 0, net: 1500, orders: 2 });
    expect(buckets[1]).toMatchObject({ gross: 0, refunds: 500, net: -500, orders: 0 });
    expect(buckets[2]).toMatchObject({ gross: 250, refunds: 0, net: 250, orders: 1 });
  });

  it('summarises gross, refunds, net and AOV', () => {
    const orders = [order(1000, 2), order(500, 2, 1), order(250, 0)];
    const buckets = buildDailyBuckets(orders, 3, now);
    const summary = summariseAnalytics(buckets, orders);

    expect(summary).toEqual({
      grossSales: 1750,
      refundAmount: 500,
      netSales: 1250,
      paidOrders: 3,
      refundedOrders: 1,
      averageOrderValue: 583.33,
    });
  });

  it('refuses a forecast with too little history', () => {
    const buckets = buildDailyBuckets([order(500, 1)], 5, now);
    const forecast = forecastNetSales(buckets);
    expect(forecast.available).toBe(false);
  });

  it('refuses a forecast with too few paid orders', () => {
    const buckets = buildDailyBuckets([order(500, 1), order(500, 2)], 30, now);
    const forecast = forecastNetSales(buckets);
    expect(forecast.available).toBe(false);
  });

  it('projects the upward trend over the horizon', () => {
    const orders = Array.from({ length: 30 }, (_, index) =>
      order(100 + index * 10, 29 - index),
    );
    const buckets = buildDailyBuckets(orders, 30, now);
    const forecast = forecastNetSales(buckets, { horizonDays: 7 });

    expect(forecast.available).toBe(true);
    if (!forecast.available) return;
    expect(forecast.trend).toBe('UP');
    expect(forecast.slopePerDay).toBeGreaterThan(5);
    expect(forecast.points).toHaveLength(7);
    expect(forecast.projectedTotal).toBeGreaterThan(0);
  });

  it('never projects negative revenue', () => {
    const orders = Array.from({ length: 20 }, (_, index) =>
      order(1000 - index * 45, 19 - index),
    );
    const buckets = buildDailyBuckets(orders, 20, now);
    const forecast = forecastNetSales(buckets, { horizonDays: 14 });

    expect(forecast.available).toBe(true);
    if (!forecast.available) return;
    expect(forecast.trend).toBe('DOWN');
    expect(forecast.points.every((point) => point.value >= 0)).toBe(true);
  });
});
