import {
  addDays,
  buildDailyBuckets,
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

  it('counts a 1 am India-time sale on that Indian day', () => {
    // 19:30 UTC on 11 Nov is 01:00 on 12 Nov in India.
    const lateSale = { totalAmount: 400, paidAt: new Date('2026-11-11T19:30:00.000Z'), refundedAt: null, status: 'PAID' };
    const utc = buildDailyBuckets([lateSale], 2, now);
    const ist = buildDailyBuckets([lateSale], 2, now, 330);
    expect(utc.find((b) => b.gross > 0)?.date).toBe('2026-11-11');
    expect(ist.find((b) => b.gross > 0)?.date).toBe('2026-11-12');
  });
});
