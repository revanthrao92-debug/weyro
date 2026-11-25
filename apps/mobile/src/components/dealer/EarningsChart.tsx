import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import type {
  AnalyticsBucket,
  ProviderAnalytics,
} from "@/hooks/useProviderAnalytics";
import { haptics } from "@/lib/haptics";
import { palette, spacing, typography } from "@/theme";
import {
  compactRupees,
  monotonePath,
  nearestIndex,
  niceMax,
  type Pt,
} from "@/utils/earningsChart";

type ForecastPoint = Extract<
  ProviderAnalytics["forecast"],
  { available: true }
>["points"][number];

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

const money = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Daily earnings as a smooth line. Drag a finger along it to read any day;
 * the forecast continues the line dotted, inside a shaded band of where it will likely land.
 */
const NONE: ForecastPoint[] = [];

export function EarningsChart({
  buckets: allBuckets,
  forecast = NONE,
  idle,
  compact = false,
  accessibilityLabel,
}: EarningsChartProps) {
  // The forecast starts today (today isn't over), so the solid line stops at yesterday.
  const today =
    forecast.length > 0
      ? allBuckets.find((b) => b.date === forecast[0].date)
      : undefined;
  const buckets = useMemo(
    () =>
      forecast.length > 0
        ? allBuckets.filter((b) => b.date < forecast[0].date)
        : allBuckets,
    [allBuckets, forecast],
  );
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const height = compact ? 168 : 220;
  const top = 12;
  const bottom = 24;
  const left = compact ? 0 : 40;
  const plotW = Math.max(0, width - left);
  const plotH = height - top - bottom;
  const total = buckets.length + forecast.length;

  const g = useMemo(() => {
    if (plotW <= 0 || buckets.length === 0) return null;
    const max = niceMax(
      Math.max(...buckets.map((b) => b.net), ...forecast.map((f) => f.high)),
    );
    const x = (i: number) =>
      left + (total <= 1 ? plotW / 2 : (i / (total - 1)) * plotW);
    const y = (v: number) => top + plotH - (Math.max(0, v) / max) * plotH;
    const base = top + plotH;
    const hist: Pt[] = buckets.map((b, i) => ({ x: x(i), y: y(b.net) }));
    const last = hist[hist.length - 1];
    const line = monotonePath(hist);
    const area = `${line}L${last.x},${base}L${hist[0].x},${base}Z`;
    let fLine = "";
    let band = "";
    if (forecast.length > 0) {
      const at = (i: number) => x(buckets.length + i);
      fLine = monotonePath([
        last,
        ...forecast.map((f, i) => ({ x: at(i), y: y(f.value) })),
      ]);
      const highs = monotonePath([
        last,
        ...forecast.map((f, i) => ({ x: at(i), y: y(f.high) })),
      ]);
      const lows = monotonePath(
        [...forecast.map((f, i) => ({ x: at(i), y: y(f.low) }))]
          .reverse()
          .concat(last),
      ).replace(/^M/, "L");
      band = `${highs}${lows}Z`;
    }
    return { max, x, y, base, last, line, area, fLine, band };
  }, [buckets, forecast, plotW, plotH, left, total]);

  const pick = (locationX: number) => {
    const i = nearestIndex(locationX - left, plotW, total);
    if (i !== active) {
      haptics.tick();
      setActive(i);
    }
  };

  const readout = (() => {
    if (active === null) return idle;
    if (active < buckets.length) {
      const b = buckets[active];
      const orders = `${b.orders} order${b.orders === 1 ? "" : "s"}`;
      return {
        label: dayLabel(b.date),
        value: money(b.net),
        meta:
          b.refunds > 0 ? `${orders}, ${money(b.refunds)} refunded` : orders,
      };
    }
    const f = forecast[active - buckets.length];
    const isToday = today?.date === f.date;
    return {
      label: isToday ? "Today, forecast" : `${dayLabel(f.date)}, forecast`,
      value: `About ${money(f.value)}`,
      meta: isToday
        ? `${money(today.net)} so far. Likely ${money(f.low)} to ${money(f.high)} by tonight`
        : `Likely ${money(f.low)} to ${money(f.high)}`,
    };
  })();

  const activeX = g && active !== null ? g.x(active) : null;
  const activeY =
    g && active !== null
      ? g.y(
          active < buckets.length
            ? buckets[active].net
            : forecast[active - buckets.length].value,
        )
      : null;
  const xLabels: {
    i: number;
    anchor: "start" | "middle" | "end";
    text: string;
  }[] = [{ i: 0, anchor: "start", text: dayLabel(buckets[0]?.date ?? "") }];
  if (forecast.length > 0) {
    xLabels.push({
      i: buckets.length,
      anchor: "middle",
      text: today ? "Today" : dayLabel(forecast[0].date),
    });
    xLabels.push({
      i: total - 1,
      anchor: "end",
      text: dayLabel(forecast[forecast.length - 1].date),
    });
  } else if (buckets.length > 1) {
    xLabels.push({
      i: buckets.length - 1,
      anchor: "end",
      text: dayLabel(buckets[buckets.length - 1].date),
    });
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.readout}>
        <Text style={styles.readLabel}>{readout.label}</Text>
        <Text style={styles.readValue}>{readout.value}</Text>
        {readout.meta ? (
          <Text style={styles.readMeta}>{readout.meta}</Text>
        ) : null}
      </View>

      <View
        style={{ height }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {g ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={palette.accent}
                  stopOpacity={0.22}
                />
                <Stop offset="1" stopColor={palette.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
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
                  <SvgText
                    key={f}
                    x={left - 6}
                    y={top + plotH * (1 - f) + 4}
                    fontSize={12}
                    fill={palette.textMuted}
                    textAnchor="end"
                  >
                    {compactRupees(g.max * f)}
                  </SvgText>
                ))
              : null}
            {g.band ? (
              <Path d={g.band} fill={palette.accent} fillOpacity={0.12} />
            ) : null}
            {g.fLine ? (
              <>
                <Line
                  x1={g.last.x}
                  x2={g.last.x}
                  y1={top}
                  y2={g.base}
                  stroke={palette.borderStrong}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <Path
                  d={g.fLine}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeLinecap="round"
                />
              </>
            ) : null}
            <Path d={g.area} fill="url(#earnFill)" />
            <Path
              d={g.line}
              fill="none"
              stroke={palette.accent}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {xLabels
              // Drop a label that would sit on top of the one before it (90 days + forecast is tight).
              .filter(
                (l, i, all) => i === 0 || g.x(l.i) - g.x(all[i - 1].i) >= 64,
              )
              .map((l) => (
                <SvgText
                  key={l.i}
                  x={g.x(l.i)}
                  y={height - 6}
                  fontSize={12}
                  fill={palette.textMuted}
                  textAnchor={l.anchor}
                >
                  {l.text}
                </SvgText>
              ))}
            {activeX !== null && activeY !== null ? (
              <>
                <Line
                  x1={activeX}
                  x2={activeX}
                  y1={top}
                  y2={g.base}
                  stroke={palette.textMuted}
                  strokeWidth={1}
                />
                <Circle
                  cx={activeX}
                  cy={activeY}
                  r={5}
                  fill={palette.accent}
                  stroke={palette.surface}
                  strokeWidth={2}
                />
              </>
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
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { minHeight: 72, marginBottom: spacing.sm },
  readLabel: { ...typography.caption, color: palette.textMuted },
  readValue: {
    ...typography.title,
    color: palette.textPrimary,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  readMeta: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
});

export default EarningsChart;
