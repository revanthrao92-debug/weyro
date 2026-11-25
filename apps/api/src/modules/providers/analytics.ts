export type AnalyticsOrder = {
  totalAmount: number;
  paidAt: Date | null;
  refundedAt: Date | null;
  status: string;
};

export type DailyBucket = {
  date: string;
  gross: number;
  refunds: number;
  net: number;
  orders: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function startOfDayUTC(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Group paid orders and refunds into one bucket per day. offsetMinutes shifts the day
 * boundary to local time (India: 330), so a 1 am sale lands on the right day.
 */
export function buildDailyBuckets(
  orders: AnalyticsOrder[],
  days: number,
  now: Date = new Date(),
  offsetMinutes = 0,
): DailyBucket[] {
  const local = (date: Date) => new Date(date.getTime() + offsetMinutes * 60_000);
  const end = startOfDayUTC(local(now));
  const start = addDays(end, -(days - 1));

  const buckets = new Map<string, DailyBucket>();
  for (let i = 0; i < days; i += 1) {
    const date = dayKey(addDays(start, i));
    buckets.set(date, { date, gross: 0, refunds: 0, net: 0, orders: 0 });
  }

  for (const order of orders) {
    const amount = Number(order.totalAmount) || 0;
    if (order.paidAt) {
      const bucket = buckets.get(dayKey(local(order.paidAt)));
      if (bucket) {
        bucket.gross += amount;
        bucket.orders += 1;
      }
    }
    if (order.refundedAt) {
      const bucket = buckets.get(dayKey(local(order.refundedAt)));
      if (bucket) bucket.refunds += amount;
    }
  }

  for (const bucket of buckets.values()) {
    bucket.gross = round(bucket.gross);
    bucket.refunds = round(bucket.refunds);
    bucket.net = round(bucket.gross - bucket.refunds);
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function summariseAnalytics(
  buckets: DailyBucket[],
  orders: AnalyticsOrder[],
) {
  const grossSales = round(buckets.reduce((sum, bucket) => sum + bucket.gross, 0));
  const refundAmount = round(
    buckets.reduce((sum, bucket) => sum + bucket.refunds, 0),
  );
  const paidOrders = buckets.reduce((sum, bucket) => sum + bucket.orders, 0);
  const refundedOrders = orders.filter((order) => order.refundedAt).length;

  return {
    grossSales,
    refundAmount,
    netSales: round(grossSales - refundAmount),
    paidOrders,
    refundedOrders,
    averageOrderValue: paidOrders === 0 ? 0 : round(grossSales / paidOrders),
  };
}
