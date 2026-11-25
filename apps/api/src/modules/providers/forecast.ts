import type { DailyBucket } from './analytics';
import { INDIA_FESTIVALS, type Festival } from './india-festivals';

/**
 * Earnings forecast for a parts dealer.
 *
 * Base model (learned from the dealer's own daily sales):
 *   expected sales on a day = trend level x weekday effect x month-start effect x festival effect
 * then adjusted for things known today: parts about to run out, nearby demand, quotes waiting,
 * the usual refund rate, and whether the shop is switched off.
 *
 * The likely range and the accuracy line come from replaying the base model on the dealer's
 * own past sales (forecast from an earlier day, compare with what really happened).
 * Each factor's rupee effect is "forecast with it" minus "forecast without it", so the
 * effects are approximate and don't add up exactly (they multiply together).
 */

export type FactorKey =
  | 'trend'
  | 'weekday'
  | 'monthStart'
  | 'festivals'
  | 'stock'
  | 'demand'
  | 'quotes'
  | 'refunds'
  | 'closed';

export type ForecastFactor = { key: FactorKey; label: string; detail: string; amount: number };
export type SkippedFactor = { key: FactorKey; label: string; reason: string };
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
      factors: ForecastFactor[];
      skipped: SkippedFactor[];
      /** How close past forecasts came, on the dealer's own sales. Null until there's enough history. */
      accuracy: { withinPct: number; checks: number } | null;
    }
  | { available: false; reason: string };

export type ForecastInput = {
  /** Complete days only (not today), oldest first, keyed by local (IST) date. */
  history: DailyBucket[];
  horizonDays?: number;
  shopOpen: boolean;
  /** Active listings with units sold in the last 28 days. */
  parts: { name: string; price: number; stock: number; unitsLast28: number }[];
  quotes: { pendingTotal: number; pendingCount: number; accepted: number; decided: number };
  /** Customer part requests in the dealer's categories: last 7 days and the 56 days before. */
  demand: { last7: number; previous56: number };
  festivals?: Festival[];
};

const DAY_MS = 86_400_000;
const MIN_DAYS = 14;
const MIN_ORDERS = 5;
const TREND_HALF_LIFE = 28; // days: a sale 4 weeks ago counts half as much as yesterday's
const TREND_DAMPING = 0.97; // the trend fades a little each day instead of running away
const BAND_Z = 1.28; // about 8 days in 10 inside the band
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const round = (v: number) => Math.round(v * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const dayOfMonth = (date: string) => Number(date.slice(8, 10));
const pct = (ratio: number) => `${Math.round(Math.abs(ratio - 1) * 100)}%`;
const rupees = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function festivalEffect(date: string, festivals: Festival[]): { mult: number; festival?: Festival } {
  for (const f of festivals) {
    if (f.date === date) return { mult: f.closes ? 0.4 : 1, festival: f };
  }
  for (const f of festivals) {
    const daysBefore = (Date.parse(`${f.date}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS;
    if (f.buildUpDays > 0 && daysBefore > 0 && daysBefore <= f.buildUpDays) return { mult: 1.15, festival: f };
  }
  return { mult: 1 };
}

/**
 * Group means pulled towards `prior` by how much of their spread is just noise:
 * K = within-group variance / true between-group variance. All noise means every group gets the prior.
 */
export function shrinkGroups(groups: number[][], prior: number): number[] {
  const used = groups.filter((g) => g.length >= 2);
  if (used.length < 2) return groups.map(() => 1);
  const within =
    sum(used.map((g) => sum(g.map((x) => (x - sum(g) / g.length) ** 2)))) /
    Math.max(1, sum(used.map((g) => g.length - 1)));
  const usedMeans = used.map((g) => sum(g) / g.length);
  const grand = sum(usedMeans) / usedMeans.length;
  const between = sum(usedMeans.map((m) => (m - grand) ** 2)) / (usedMeans.length - 1);
  const avgN = sum(used.map((g) => g.length)) / used.length;
  const tau2 = Math.max(0, between - within / avgN);
  return groups.map((g) => {
    if (tau2 === 0 || g.length === 0) return 1;
    const K = within / tau2;
    return (sum(g) + K * prior) / (g.length + K) / prior;
  });
}

type Model = {
  lastDate: string;
  level: number;
  slope: number;
  weekday: number[] | null;
  monthStart: number | null;
  refundRate: number;
  residualSd: number;
  days: number;
};

type Switches = { trend: boolean; weekday: boolean; monthStart: boolean; festivals: boolean };
const ALL_ON: Switches = { trend: true, weekday: true, monthStart: true, festivals: true };

/** Learn the base model from complete days of sales. Null when there's too little to learn from. */
export function fitModel(history: DailyBucket[], festivals: Festival[]): Model | null {
  const first = history.findIndex((d) => d.orders > 0);
  if (first < 0) return null;
  const days = history.slice(first); // days before the first sale say nothing about the shop
  if (days.length < MIN_DAYS || sum(days.map((d) => d.orders)) < MIN_ORDERS) return null;

  const isNormal = (d: DailyBucket) => festivalEffect(d.date, festivals).mult === 1;
  const recent = days.slice(-84);
  const normalRecent = recent.filter(isNormal);
  const mean = normalRecent.length ? sum(normalRecent.map((d) => d.gross)) / normalRecent.length : 0;
  if (mean <= 0) return null;

  // Weekday effect: each weekday's average against the overall average, shrunk towards "no effect"
  // by how noisy single days are (empirical Bayes). With lumpy sales (one ₹13,000 part on a Monday)
  // a weekday must stand out from the noise, not just from the average, to count.
  let weekdayFx: number[] | null = null;
  if (recent.length >= 28) {
    const groups = [0, 1, 2, 3, 4, 5, 6].map((w) => normalRecent.filter((d) => weekday(d.date) === w).map((d) => d.gross));
    const raw = shrinkGroups(groups, mean);
    const avg = sum(raw) / 7;
    weekdayFx = raw.map((f) => f / avg);
    if (weekdayFx.every((f) => Math.abs(f - 1) < 0.03)) weekdayFx = null; // no real pattern
  }
  const wk = (date: string) => (weekdayFx ? weekdayFx[weekday(date)] : 1);

  // Month-start effect (pay-day): each day against the average of the 4 weeks around it (so growth
  // doesn't look like a month effect), after removing the weekday effect; then shrunk by noise.
  let monthStart: number | null = null;
  if (days.length >= 60) {
    const adjusted = days.map((d) => d.gross / wk(d.date));
    const rel = days.flatMap((d, i) => {
      if (!isNormal(d)) return [];
      const around = adjusted.slice(Math.max(0, i - 14), i + 15);
      const local = sum(around) / around.length;
      return local > 0 ? [{ start: dayOfMonth(d.date) <= 7, r: adjusted[i] / local }] : [];
    });
    const shrunk = shrinkGroups([rel.filter((x) => x.start).map((x) => x.r), rel.filter((x) => !x.start).map((x) => x.r)], 1);
    const ratio = shrunk[1] > 0 ? shrunk[0] / shrunk[1] : 1;
    if (Math.abs(ratio - 1) >= 0.03) monthStart = clamp(ratio, 0.75, 1.35);
  }
  const ms = (date: string) => (monthStart && dayOfMonth(date) <= 7 ? monthStart : 1);

  // Trend: weighted straight line through the seasonally adjusted sales, recent days weigh more.
  const window = days.slice(-90);
  const T = window.length - 1;
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  window.forEach((d, x) => {
    if (!isNormal(d)) return;
    const y = d.gross / (wk(d.date) * ms(d.date));
    const w = 0.5 ** ((T - x) / TREND_HALF_LIFE);
    sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y;
  });
  const denom = sw * sxx - sx * sx;
  const slope = denom > 0 ? (sw * sxy - sx * sy) / denom : 0;
  const intercept = sw > 0 ? (sy - slope * sx) / sw : mean;
  const level = Math.max(0, intercept + slope * T);

  const residuals = window.flatMap((d, x) =>
    isNormal(d) ? [d.gross - (intercept + slope * x) * wk(d.date) * ms(d.date)] : [],
  );
  const residualSd = Math.sqrt(sum(residuals.map((r) => r * r)) / Math.max(1, residuals.length - 2));

  const last90 = days.slice(-90);
  const gross90 = sum(last90.map((d) => d.gross));
  const refundRate = gross90 > 0 ? clamp(sum(last90.map((d) => d.refunds)) / gross90, 0, 0.5) : 0;

  return { lastDate: days[days.length - 1].date, level, slope, weekday: weekdayFx, monthStart, refundRate, residualSd, days: days.length };
}

/** Expected gross sales for each of the next `horizon` days, with chosen effects switched on. */
export function project(model: Model, horizon: number, festivals: Festival[], on: Switches = ALL_ON): number[] {
  const out: number[] = [];
  let trendSum = 0;
  for (let i = 1; i <= horizon; i++) {
    trendSum += TREND_DAMPING ** i;
    const date = addDays(model.lastDate, i);
    const level = Math.max(0, model.level + (on.trend ? model.slope * trendSum : 0));
    const w = on.weekday && model.weekday ? model.weekday[weekday(date)] : 1;
    const m = on.monthStart && model.monthStart && dayOfMonth(date) <= 7 ? model.monthStart : 1;
    const f = on.festivals ? festivalEffect(date, festivals).mult : 1;
    out.push(level * w * m * f);
  }
  return out;
}

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Replay: forecast 14 days from earlier points in the dealer's history and compare with what
 * really happened. Only the base model is replayed: we don't have past snapshots of stock,
 * quotes or demand. Returns relative errors of the 14-day totals, newest first.
 */
export function backtest(history: DailyBucket[], horizon: number, festivals: Festival[]): number[] {
  const errors: number[] = [];
  for (let end = history.length - horizon; end >= 28 && errors.length < 8; end -= 7) {
    const model = fitModel(history.slice(0, end), festivals);
    if (!model || model.days < 28) continue;
    const predicted = sum(project(model, horizon, festivals)) * (1 - model.refundRate);
    const actual = sum(history.slice(end, end + horizon).map((d) => d.gross - d.refunds));
    if (predicted > 0) errors.push((actual - predicted) / predicted);
  }
  return errors;
}

export function forecastEarnings(input: ForecastInput): Forecast {
  const horizon = input.horizonDays ?? 14;
  const festivals = input.festivals ?? INDIA_FESTIVALS;
  const history = input.history;
  const salesDays = history.length - Math.max(0, history.findIndex((d) => d.orders > 0));
  const orderCount = sum(history.map((d) => d.orders));
  if (orderCount < MIN_ORDERS) {
    return { available: false, reason: `At least ${MIN_ORDERS} paid orders are needed for a forecast.` };
  }
  const model = fitModel(history, festivals);
  if (!model) {
    return { available: false, reason: `At least ${MIN_DAYS} days of sales are needed for a forecast.` };
  }

  const keep = 1 - model.refundRate;
  const dates = Array.from({ length: horizon }, (_, i) => addDays(model.lastDate, i + 1));
  const base = project(model, horizon, festivals);
  const without = (off: Partial<Switches>) => sum(project(model, horizon, festivals, { ...ALL_ON, ...off }));
  const baseTotal = sum(base);
  const factors: ForecastFactor[] = [];
  const skipped: SkippedFactor[] = [];

  // Trend
  const weekly = model.level > 0 ? (model.slope * 7) / model.level : 0;
  factors.push({
    key: 'trend',
    label: 'Growth trend',
    detail:
      Math.abs(weekly) < 0.02
        ? 'Sales are steady, neither growing nor slowing.'
        : `Sales are ${weekly > 0 ? 'growing' : 'slowing'} about ${Math.round(Math.abs(weekly) * 100)}% a week.`,
    amount: (baseTotal - without({ trend: false })) * keep,
  });

  // Weekday
  if (model.weekday) {
    const fx = model.weekday;
    const best = fx.indexOf(Math.max(...fx));
    const worst = fx.indexOf(Math.min(...fx));
    factors.push({
      key: 'weekday',
      label: 'Day of the week',
      detail: `${WEEKDAYS[best]} are usually ${pct(fx[best])} busier, ${WEEKDAYS[worst]} ${pct(fx[worst])} slower.`,
      amount: (baseTotal - without({ weekday: false })) * keep,
    });
  } else {
    skipped.push({
      key: 'weekday',
      label: 'Day of the week',
      reason:
        salesDays < 28
          ? `Needs 4 weeks of sales (you have ${salesDays} days).`
          : 'No day of the week stands out in your sales yet.',
    });
  }

  // Month start
  if (model.monthStart) {
    factors.push({
      key: 'monthStart',
      label: 'Start of the month',
      detail: `The first week of the month is usually ${pct(model.monthStart)} ${model.monthStart >= 1 ? 'busier' : 'slower'}.`,
      amount: (baseTotal - without({ monthStart: false })) * keep,
    });
  } else {
    skipped.push({
      key: 'monthStart',
      label: 'Start of the month',
      reason:
        salesDays < 60
          ? `Needs 2 months of sales (you have ${salesDays} days).`
          : 'No pay-day pattern in your sales: the first week sells like any other.',
    });
  }

  // Festivals
  const ahead = [...new Set(dates.map((d) => festivalEffect(d, festivals).festival).filter((f): f is Festival => !!f))];
  if (ahead.length > 0) {
    factors.push({
      key: 'festivals',
      label: 'Festivals and holidays',
      detail: ahead
        .map((f) => `${f.name} on ${shortDate(f.date)}${f.buildUpDays > 0 ? ': busier before, quiet on the day' : ': most shops close'}`)
        .join('. ') + '. Based on the usual pattern for Indian shops.',
      amount: (baseTotal - without({ festivals: false })) * keep,
    });
  } else {
    skipped.push({ key: 'festivals', label: 'Festivals and holidays', reason: `No festivals in the next ${horizon} days.` });
  }

  // Demand nearby: requests this week against the usual week, half-weighted and fading over two weeks.
  let demandMult = dates.map(() => 1);
  const typicalWeek = input.demand.previous56 / 8;
  if (input.demand.previous56 >= 8) {
    const change = clamp(0.5 * (input.demand.last7 / typicalWeek - 1), -0.25, 0.25);
    demandMult = dates.map((_, i) => 1 + change * Math.max(0, 1 - i / horizon));
    const amount = sum(base.map((v, i) => v * (demandMult[i] - 1))) * keep;
    factors.push({
      key: 'demand',
      label: 'Demand near you',
      detail:
        Math.abs(input.demand.last7 - typicalWeek) < 1
          ? `About as many part requests near you as usual (${input.demand.last7} this week).`
          : `${input.demand.last7} part requests near you this week, against about ${Math.round(typicalWeek)} in a usual week.`,
      amount,
    });
  } else {
    skipped.push({ key: 'demand', label: 'Demand near you', reason: 'Not enough part requests near you yet to compare weeks.' });
  }

  // Stock: a part that runs out stops selling from that day on.
  const lost = dates.map(() => 0);
  let firstOut: { name: string; inDays: number } | null = null;
  for (const part of input.parts) {
    const perDay = part.unitsLast28 / 28;
    if (perDay <= 0) continue;
    const runsOutIn = part.stock / perDay;
    if (runsOutIn >= horizon) continue;
    for (let i = 0; i < horizon; i++) {
      const soldOutShare = clamp(i + 1 - runsOutIn, 0, 1); // the part of day i+1 after it ran out
      lost[i] += soldOutShare * perDay * part.price;
    }
    if (!firstOut || runsOutIn < firstOut.inDays) firstOut = { name: part.name, inDays: runsOutIn };
  }
  const gross = base.map((v, i) => Math.max(0, v * demandMult[i] - lost[i]));
  const stockLoss = sum(base.map((v, i) => v * demandMult[i])) - sum(gross);
  if (firstOut && stockLoss > 0) {
    const days = Math.max(1, Math.round(firstOut.inDays));
    factors.push({
      key: 'stock',
      label: 'Parts running out',
      detail:
        firstOut.inDays < 0.5
          ? `${firstOut.name} is out of stock. Restock to win these sales back.`
          : `${firstOut.name} may run out in about ${days} day${days === 1 ? '' : 's'}. Restock to win these sales back.`,
      amount: -stockLoss * keep,
    });
  } else {
    skipped.push({ key: 'stock', label: 'Parts running out', reason: `Enough stock for the next ${horizon} days at your usual pace.` });
  }

  // Quotes waiting, at the dealer's usual win rate, spread over the next week.
  const quoteDays = Math.min(7, horizon);
  if (input.quotes.pendingCount > 0 && input.quotes.decided >= 5) {
    const winRate = input.quotes.accepted / input.quotes.decided;
    const expected = input.quotes.pendingTotal * winRate;
    for (let i = 0; i < quoteDays; i++) gross[i] += expected / quoteDays;
    factors.push({
      key: 'quotes',
      label: 'Quotes waiting',
      detail: `${input.quotes.pendingCount} quote${input.quotes.pendingCount === 1 ? '' : 's'} waiting (${rupees(
        input.quotes.pendingTotal,
      )}). You usually win ${Math.round(winRate * 100)}%.`,
      amount: expected,
    });
  } else {
    skipped.push({
      key: 'quotes',
      label: 'Quotes waiting',
      reason:
        input.quotes.pendingCount === 0
          ? 'No quotes waiting for an answer.'
          : 'Needs 5 answered quotes to know how often you win.',
    });
  }

  // Refunds
  let net = gross.map((v) => v * keep);
  if (model.refundRate > 0) {
    factors.push({
      key: 'refunds',
      label: 'Refunds',
      detail: `You usually refund about ${Math.round(model.refundRate * 100)}% of sales.`,
      amount: -(sum(gross) - sum(net)),
    });
  }

  // Shop switched off: nothing sells until it's back on.
  if (!input.shopOpen) {
    factors.push({
      key: 'closed',
      label: 'Shop is switched off',
      detail: 'Customers cannot order until you turn on "Accepting orders". This forecast is ₹0 until then.',
      amount: -sum(net),
    });
    net = net.map(() => 0);
  }

  const total = sum(net);
  const halfBand = input.shopOpen ? BAND_Z * model.residualSd * keep : 0;
  const points = dates.map((date, i) => ({
    date,
    value: round(net[i]),
    low: round(Math.max(0, net[i] - halfBand)),
    high: round(net[i] + halfBand),
  }));

  // Range for the total: from the replay errors when there are enough, else from day-to-day spread.
  const errors = backtest(history.slice(history.length - salesDays), horizon, festivals);
  let low = Math.max(0, total - halfBand * Math.sqrt(horizon));
  let high = total + halfBand * Math.sqrt(horizon);
  let accuracy: { withinPct: number; checks: number } | null = null;
  if (errors.length >= 3) {
    const sorted = [...errors].sort((a, b) => a - b);
    const abs = errors.map(Math.abs).sort((a, b) => a - b);
    accuracy = { withinPct: Math.round(quantile(abs, 0.5) * 100), checks: errors.length };
    if (input.shopOpen) {
      low = Math.max(0, Math.min(total, total * (1 + quantile(sorted, 0.1))));
      high = Math.max(total, total * (1 + quantile(sorted, 0.9)));
    }
  }

  factors.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return {
    available: true,
    horizonDays: horizon,
    slopePerDay: round(model.slope * keep),
    projectedTotal: round(total),
    projectedLow: round(low),
    projectedHigh: round(high),
    trend: weekly > 0.02 ? 'UP' : weekly < -0.02 ? 'DOWN' : 'FLAT',
    points,
    factors: factors.map((f) => ({ ...f, amount: round(f.amount) })),
    skipped,
    accuracy,
  };
}
