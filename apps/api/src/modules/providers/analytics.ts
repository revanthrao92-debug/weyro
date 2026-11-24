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

/** low/high: the likely range for that day (about 8 days in 10 land inside it). */
export type ForecastPoint = { date: string; value: number; low: number; high: number };

export type Forecast =
  | {
      available: true;
      horizonDays: number;
      slopePerDay: number;
      projectedTotal: number;
      projectedLow: number;
      projectedHigh: number;
      trend: 'UP' | 'DOWN' | 'FLAT';
      points: ForecastPoint[];
    }
  | { available: false; reason: string };

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

/** Group paid orders and refunds into one bucket per UTC day. */
export function buildDailyBuckets(
  orders: AnalyticsOrder[],
  days: number,
  now: Date = new Date(),
): DailyBucket[] {
  const end = startOfDayUTC(now);
  const start = addDays(end, -(days - 1));

  const buckets = new Map<string, DailyBucket>();
  for (let i = 0; i < days; i += 1) {
    const date = dayKey(addDays(start, i));
    buckets.set(date, { date, gross: 0, refunds: 0, net: 0, orders: 0 });
  }

  for (const order of orders) {
    const amount = Number(order.totalAmount) || 0;
    if (order.paidAt) {
      const bucket = buckets.get(dayKey(order.paidAt));
      if (bucket) {
        bucket.gross += amount;
        bucket.orders += 1;
      }
    }
    if (order.refundedAt) {
      const bucket = buckets.get(dayKey(order.refundedAt));
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

/**
 * Least-squares line over the daily net series, projected forward.
 * Deliberately small: no ML, no external service, testable in isolation.
 */
export function forecastNetSales(
  buckets: DailyBucket[],
  options: { horizonDays?: number; minDays?: number; minOrders?: number } = {},
): Forecast {
  const horizonDays = options.horizonDays ?? 14;
  const minDays = options.minDays ?? 14;
  const minOrders = options.minOrders ?? 5;

  const orderCount = buckets.reduce((sum, bucket) => sum + bucket.orders, 0);
  if (buckets.length < minDays) {
    return {
      available: false,
      reason: `At least ${minDays} days of history is needed for a forecast.`,
    };
  }
  if (orderCount < minOrders) {
    return {
      available: false,
      reason: `At least ${minOrders} paid orders are needed for a forecast.`,
    };
  }

  const n = buckets.length;
  const meanX = (n - 1) / 2;
  const meanY = buckets.reduce((sum, bucket) => sum + bucket.net, 0) / n;

  let numerator = 0;
  let denominator = 0;
  buckets.forEach((bucket, index) => {
    numerator += (index - meanX) * (bucket.net - meanY);
    denominator += (index - meanX) ** 2;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;
  // Spread of past days around the trend line; 1.28 sd covers ~80% of a normal spread.
  const residualSd = Math.sqrt(
    buckets.reduce((sum, bucket, index) => sum + (bucket.net - (intercept + slope * index)) ** 2, 0) /
      Math.max(1, n - 2),
  );
  const halfBand = 1.28 * residualSd;

  const lastDate = new Date(`${buckets[buckets.length - 1].date}T00:00:00.000Z`);
  const points: ForecastPoint[] = [];
  for (let step = 1; step <= horizonDays; step += 1) {
    const value = Math.max(0, intercept + slope * (n - 1 + step));
    points.push({
      date: dayKey(addDays(lastDate, step)),
      value: round(value),
      low: round(Math.max(0, value - halfBand)),
      high: round(value + halfBand),
    });
  }

  const projectedTotal = round(points.reduce((sum, point) => sum + point.value, 0));
  // A sum of h noisy days spreads by sqrt(h), not h: daily bands added up would overstate it.
  const totalHalfBand = halfBand * Math.sqrt(horizonDays);
  const trend = slope > 1 ? 'UP' : slope < -1 ? 'DOWN' : 'FLAT';

  return {
    available: true,
    horizonDays,
    slopePerDay: round(slope),
    projectedTotal,
    projectedLow: round(Math.max(0, projectedTotal - totalHalfBand)),
    projectedHigh: round(projectedTotal + totalHalfBand),
    trend,
    points,
  };
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
