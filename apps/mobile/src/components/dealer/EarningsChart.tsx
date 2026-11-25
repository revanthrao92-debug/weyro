import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { AnalyticsBucket, ProviderAnalytics } from '@/hooks/useProviderAnalytics';
import { haptics } from '@/lib/haptics';
import { palette, spacing, typography } from '@/theme';
import { compactRupees, monotonePath, niceMax, rollingAverage } from '@/utils/earningsChart';

type ForecastPoint = Extract<ProviderAnalytics['forecast'], { available: true }>['points'][number];

export interface EarningsChartProps {
  buckets: AnalyticsBucket[];
  /** Forecast days drawn after the last real day as a dotted line with a shaded likely range. */
  forecast?: ForecastPoint[];
  /** What the readout shows when no day is being touched. */
  idle: { label: string; value: string; meta?: string };
  /** Smaller version for the Dashboard: no value gridline labels. */
  compact?: boolean;
  /** Plain-language summary for screen readers. */
  accessibilityLabel: string;
}

const money = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const NONE: ForecastPoint[] = [];
const AVERAGE_DAYS = 7;

/**
 * Each day's sales as a thin bar (big and empty days stay honest), with a smooth 7-day average
 * line on top showing the real direction. The forecast continues the average line dotted, inside
 * a soft band of where it will likely land. Drag a finger along it to read any day.
 */
export function EarningsChart({ buckets: allBuckets, forecast = NONE, idle, compact = false, accessibilityLabel }: EarningsChartProps) {
  // The forecast starts today (today isn't over), so the bars stop at yesterday.
  const today = forecast.length > 0 ? allBuckets.find((b) => b.date === forecast[0].date) : undefined;
  const buckets = useMemo(
    () => (forecast.length > 0 ? allBuckets.filter((b) => b.date < forecast[0].date) : allBuckets),
    [allBuckets, forecast],
  );
  const average = useMemo(() => rollingAverage(buckets.map((b) => b.net), AVERAGE_DAYS), [buckets]);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const height = compact ? 168 : 220;
  const top = 12;
  const bottom = 24;
  const left = compact ? 0 : 40;
  const plotW = Math.max(0, width - left);
  const plotH = height - top - bottom;
  const total = buckets.length + forecast.length;
  const slot = total > 0 ? plotW / total : 0; // each day gets an equal slot; bars and points sit in its middle

  const g = useMemo(() => {
    if (plotW <= 0 || buckets.length === 0) return null;
    const max = niceMax(Math.max(...buckets.map((b) => b.net), ...forecast.map((f) => f.high)));
    const x = (i: number) => left + (i + 0.5) * slot;
    const y = (v: number) => top + plotH - (Math.max(0, v) / max) * plotH;
    const base = top + plotH;
    const barW = Math.max(1, slot - (slot > 4 ? 2 : 1)); // 2px gap between bars when there's room
    const bars = buckets.map((b, i) => ({ x: x(i) - barW / 2, y: y(b.net), h: base - y(b.net) }));
    const avgPts = average.map((v, i) => ({ x: x(i), y: y(v) }));
    const last = avgPts[avgPts.length - 1];
    const avgLine = monotonePath(avgPts);
    let fLine = '';
    let band = '';
    if (forecast.length > 0) {
      const at = (i: number) => x(buckets.length + i);
      fLine = monotonePath([last, ...forecast.map((f, i) => ({ x: at(i), y: y(f.value) }))]);
      const highs = monotonePath([last, ...forecast.map((f, i) => ({ x: at(i), y: y(f.high) }))]);
      const lows = monotonePath([...forecast.map((f, i) => ({ x: at(i), y: y(f.low) }))].reverse().concat(last)).replace(
        /^M/,
        'L',
      );
      band = `${highs}${lows}Z`;
    }
    return { max, x, y, base, barW, bars, avgLine, last, fLine, band };
  }, [buckets, average, forecast, plotW, plotH, left, slot]);

  const pick = (locationX: number) => {
    if (total === 0 || slot <= 0) return;
    const i = Math.min(total - 1, Math.max(0, Math.floor((locationX - left) / slot)));
    if (i !== active) {
      haptics.tick();
      setActive(i);
    }
  };

  const readout = (() => {
    if (active === null) return idle;
    if (active < buckets.length) {
      const b = buckets[active];
      const orders = `${b.orders} order${b.orders === 1 ? '' : 's'}`;
      return {
        label: dayLabel(b.date),
        value: money(b.net),
        meta: `${b.refunds > 0 ? `${orders}, ${money(b.refunds)} refunded` : orders}. 7-day average ${money(average[active])}`,
      };
    }
    const f = forecast[active - buckets.length];
    const isToday = today?.date === f.date;
    return {
      label: isToday ? 'Today, forecast' : `${dayLabel(f.date)}, forecast`,
      value: `About ${money(f.value)}`,
      meta: isToday
        ? `${money(today.net)} so far. Likely ${money(f.low)} to ${money(f.high)} by tonight`
        : `Likely ${money(f.low)} to ${money(f.high)}`,
    };
  })();

  const xLabels: { i: number; anchor: 'start' | 'middle' | 'end'; text: string }[] = [
    { i: 0, anchor: 'start', text: dayLabel(buckets[0]?.date ?? '') },
  ];
  if (forecast.length > 0) {
    xLabels.push({ i: buckets.length, anchor: 'middle', text: today ? 'Today' : dayLabel(forecast[0].date) });
    xLabels.push({ i: total - 1, anchor: 'end', text: dayLabel(forecast[forecast.length - 1].date) });
  } else if (buckets.length > 1) {
    xLabels.push({ i: buckets.length - 1, anchor: 'end', text: dayLabel(buckets[buckets.length - 1].date) });
  }
  const labelX = (l: (typeof xLabels)[number]) =>
    g ? (l.anchor === 'start' ? left : l.anchor === 'end' ? width : g.x(l.i)) : 0;

  const activeForecast = g && active !== null && active >= buckets.length ? forecast[active - buckets.length] : null;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.readout}>
        <Text style={styles.readLabel}>{readout.label}</Text>
        <Text style={styles.readValue}>{readout.value}</Text>
        {readout.meta ? <Text style={styles.readMeta}>{readout.meta}</Text> : null}
      </View>

      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {g ? (
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={left}
                x2={width}
                y1={top + plotH * f}
                y2={top + plotH * f}
                stroke={palette.border}
                strokeWidth={StyleSheet.hairlineWidth}
              />
            ))}
            {!compact
              ? [1, 0.5].map((f) => (
                  <SvgText key={f} x={left - 6} y={top + plotH * (1 - f) + 4} fontSize={12} fill={palette.textMuted} textAnchor="end">
                    {compactRupees(g.max * f)}
                  </SvgText>
                ))
              : null}

            {g.bars.map((bar, i) => (
              <Rect
                key={i}
                x={bar.x}
                y={bar.y}
                width={g.barW}
                height={Math.max(0, bar.h)}
                rx={Math.min(2, g.barW / 2)}
                fill={palette.accent}
                fillOpacity={active === null ? 0.32 : active === i ? 0.9 : 0.2}
              />
            ))}

            {g.band ? <Path d={g.band} fill={palette.accent} fillOpacity={0.1} /> : null}
            {g.fLine ? (
              <>
                <Line
                  x1={g.last.x + g.barW / 2 + 1}
                  x2={g.last.x + g.barW / 2 + 1}
                  y1={top}
                  y2={g.base}
                  stroke={palette.borderStrong}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <Path d={g.fLine} fill="none" stroke={palette.accent} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />
              </>
            ) : null}
            <Path d={g.avgLine} fill="none" stroke={palette.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

            {xLabels
              // Drop a label that would sit on top of the one before it (90 days + forecast is tight).
              .filter((l, i, all) => i === 0 || labelX(l) - labelX(all[i - 1]) >= 64)
              .map((l) => (
                <SvgText key={l.i} x={labelX(l)} y={height - 6} fontSize={12} fill={palette.textMuted} textAnchor={l.anchor}>
                  {l.text}
                </SvgText>
              ))}

            {active !== null ? (
              <Line x1={g.x(active)} x2={g.x(active)} y1={top} y2={g.base} stroke={palette.textMuted} strokeWidth={1} />
            ) : null}
            {active !== null && active < buckets.length ? (
              <Circle cx={g.x(active)} cy={g.y(average[active])} r={4.5} fill={palette.accent} stroke={palette.surface} strokeWidth={2} />
            ) : null}
            {activeForecast && active !== null ? (
              <Circle cx={g.x(active)} cy={g.y(activeForecast.value)} r={4.5} fill={palette.accent} stroke={palette.surface} strokeWidth={2} />
            ) : null}
          </Svg>
        ) : null}
        {/* Touch layer: a plain view on top so locationX is measured from the chart's left edge. */}
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
          onResponderMove={(e) => pick(e.nativeEvent.locationX)}
          onResponderRelease={() => setActive(null)}
          onResponderTerminate={() => setActive(null)}
        />
      </View>

      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.legendItem}>
          <View style={styles.keyBar} />
          <Text style={styles.legendText}>Daily sales</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.keyLine} />
          <Text style={styles.legendText}>7-day average</Text>
        </View>
        {forecast.length > 0 ? (
          <View style={styles.legendItem}>
            <View style={styles.keyDash} />
            <Text style={styles.legendText}>Forecast</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { minHeight: 72, marginBottom: spacing.sm },
  readLabel: { ...typography.caption, color: palette.textMuted },
  readValue: { ...typography.title, color: palette.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  readMeta: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { ...typography.caption, color: palette.textMuted },
  keyBar: { width: 6, height: 12, borderRadius: 2, backgroundColor: palette.accent, opacity: 0.4 },
  keyLine: { width: 16, height: 2.5, borderRadius: 2, backgroundColor: palette.accent },
  keyDash: { width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: palette.accent },
});

export default EarningsChart;
