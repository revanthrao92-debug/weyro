/** Pure geometry for the earnings chart, kept apart from the component so it can be unit-tested. */

export type Pt = { x: number; y: number };

/**
 * Smooth SVG path through the points that never overshoots between them
 * (monotone cubic, Fritsch-Carlson), so a curve can't dip below ₹0 or bulge above a peak.
 */
export function monotonePath(points: Pt[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${points[0].x},${points[0].y}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push(dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i]);
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i];
      tangent[i + 1] = t * b * slope[i];
    }
  }
  let d = `M${r(points[0].x)},${r(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    d += `C${r(points[i].x + third)},${r(points[i].y + tangent[i] * third)} ${r(points[i + 1].x - third)},${r(
      points[i + 1].y - tangent[i + 1] * third,
    )} ${r(points[i + 1].x)},${r(points[i + 1].y)}`;
  }
  return d;
}

const r = (v: number) => Math.round(v * 10) / 10;

/** A rounded axis top above `max` (1, 2 or 5 × 10ⁿ steps), so gridline labels read cleanly. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}

/** Trailing average over the last `days` values (shorter at the start), to smooth lumpy daily sales. */
export function rollingAverage(values: number[], days: number): number[] {
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= days) sum -= values[i - days];
    return sum / Math.min(i + 1, days);
  });
}

/** ₹1,234 → "₹1.2k", ₹2,40,000 → "₹2.4L" for tight axis labels. */
export function compactRupees(value: number): string {
  const v = Math.round(value);
  if (v >= 100000) return `₹${trim(v / 100000)}L`;
  if (v >= 1000) return `₹${trim(v / 1000)}k`;
  return `₹${v}`;
}

const trim = (v: number) => (v >= 10 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());
