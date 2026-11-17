import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Circle,
  Line,
  Polyline,
  Rect,
  Svg,
  Text as SvgText,
} from 'react-native-svg';
import { BackButton, AppHeader, Chip, ScreenContainer, Skeleton, ErrorState } from '@/components/ui';
import { useProviderAnalytics, type AnalyticsBucket } from '@/hooks/useProviderAnalytics';
import {
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';
import { useRefreshControl } from '@/hooks/useRefreshControl';

const RANGES = [7, 30, 90] as const;
const METRICS = [
  { key: 'net', label: 'Net' },
  { key: 'gross', label: 'Gross' },
] as const;

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function shortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function FinancialsScreen() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('net');
  const [selected, setSelected] = useState<AnalyticsBucket | null>(null);
  const [chartWidth, setChartWidth] = useState(320);
  const { data, isLoading, isError, refetch } = useProviderAnalytics(days);
  const refreshControl = useRefreshControl(refetch);

  const buckets = useMemo(() => data?.buckets ?? [], [data?.buckets]);
  const forecast = data?.forecast;
  const forecastPoints = useMemo(
    () => (forecast?.available ? forecast.points : []),
    [forecast],
  );

  const selectedBucket = selected ?? buckets[buckets.length - 1] ?? null;
  const summary = data?.summary;

  const chart = useMemo(() => {
    const height = 190;
    const top = 14;
    const bottom = 26;
    const plotHeight = height - top - bottom;
    const hasForecast = forecastPoints.length > 0;
    const historyWidth = hasForecast ? Math.round(chartWidth * 0.74) : chartWidth;
    const values = buckets.map((bucket) => (metric === 'net' ? bucket.net : bucket.gross));
    const maxValue = Math.max(
      1,
      ...values,
      ...(metric === 'net' ? forecastPoints.map((point) => point.value) : []),
    );
    const gap = buckets.length > 40 ? 1 : 2;
    const barWidth = Math.max(
      1,
      (historyWidth - gap * Math.max(0, buckets.length - 1)) / Math.max(1, buckets.length),
    );
    const y = (value: number) => top + plotHeight - (Math.max(0, value) / maxValue) * plotHeight;

    const bars = buckets.map((bucket, index) => ({
      bucket,
      x: index * (barWidth + gap),
      y: y(metric === 'net' ? bucket.net : bucket.gross),
      height: Math.max(1, top + plotHeight - y(metric === 'net' ? bucket.net : bucket.gross)),
    }));

    const lastX = buckets.length
      ? (buckets.length - 1) * (barWidth + gap) + barWidth
      : 0;
    const remaining = Math.max(1, chartWidth - lastX - 4);
    const forecastStep = forecastPoints.length > 0 ? remaining / forecastPoints.length : 0;
    const forecastLine = forecastPoints
      .map((point, index) => `${lastX + forecastStep * (index + 1)},${y(point.value)}`)
      .join(' ');
    const lastValue = buckets.length
      ? metric === 'net'
        ? buckets[buckets.length - 1].net
        : buckets[buckets.length - 1].gross
      : 0;
    const labelEvery = buckets.length > 40 ? 14 : buckets.length > 14 ? 7 : 1;
    const labelIndices = new Set<number>();
    for (let index = 0; index < buckets.length; index += labelEvery) {
      labelIndices.add(index);
    }
    const lastIndex = buckets.length - 1;
    if (lastIndex >= 0 && lastIndex % labelEvery >= 3) labelIndices.add(lastIndex);

    return {
      height,
      top,
      plotHeight,
      bars,
      barWidth,
      forecastLine,
      historyWidth,
      lastPoint:
        forecastPoints.length > 0
          ? { x: lastX, y: y(lastValue) }
          : null,
      labelIndices,
    };
  }, [buckets, chartWidth, forecastPoints, metric]);

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Financials" subtitle="Sales and forecast" />
        <View style={styles.body}>
          <Skeleton width="100%" height={110} />
          <Skeleton width="100%" height={220} style={{ marginTop: spacing.md }} />
          <Skeleton width="100%" height={140} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (isError && !data) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Financials" subtitle="Sales and forecast" />
        <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <AppHeader left={<BackButton />} title="Financials" subtitle="Sales and forecast" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <View style={styles.rangeRow}>
          {RANGES.map((range) => (
            <Chip
              key={range}
              label={`${range}d`}
              selected={days === range}
              onPress={() => {
                setDays(range);
                setSelected(null);
              }}
            />
          ))}
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Net sales · last {days} days</Text>
          <Text style={styles.heroValue}>{money(summary?.netSales ?? 0)}</Text>
          <Text style={styles.heroMeta}>
            {money(summary?.grossSales ?? 0)} gross · {money(summary?.refundAmount ?? 0)} refunded
          </Text>
        </View>

        <View style={styles.metricRow}>
          {METRICS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              selected={metric === item.key}
              onPress={() => setMetric(item.key)}
            />
          ))}
        </View>

        <View
          style={styles.chartCard}
          onLayout={(event) => setChartWidth(Math.max(240, event.nativeEvent.layout.width - 2))}
        >
          <View>
          <Svg width={chartWidth} height={chart.height}>
            {[0, 0.5, 1].map((fraction) => (
              <Line
                key={fraction}
                x1={0}
                x2={chartWidth}
                y1={chart.top + chart.plotHeight * fraction}
                y2={chart.top + chart.plotHeight * fraction}
                stroke={palette.border}
                strokeWidth={StyleSheet.hairlineWidth}
              />
            ))}
            {chart.bars.map((bar) => {
              const isSelected = selectedBucket?.date === bar.bucket.date;
              return (
                <Rect
                  key={bar.bucket.date}
                  x={bar.x}
                  y={bar.y}
                  width={chart.barWidth}
                  height={bar.height}
                  rx={Math.min(2, chart.barWidth / 2)}
                  fill={isSelected ? palette.accent : palette.borderStrong}
                  stroke={isSelected ? palette.accent : undefined}
                />
              );
            })}
            {chart.forecastLine ? (
              <Polyline
                points={chart.forecastLine}
                fill="none"
                stroke={palette.warning}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            ) : null}
            {chart.lastPoint && forecastPoints.length > 0 ? (
              <Circle
                cx={chart.lastPoint.x}
                cy={chart.lastPoint.y}
                r={2.5}
                fill={palette.warning}
              />
            ) : null}
            {chart.bars.map((bar, index) =>
              chart.labelIndices.has(index) ? (
                <SvgText
                  key={`label-${bar.bucket.date}`}
                  x={bar.x + chart.barWidth / 2}
                  y={chart.height - 8}
                  fontSize={9}
                  fill={palette.textMuted}
                  textAnchor="middle"
                >
                  {shortDate(bar.bucket.date).split(' ')[0]}
                </SvgText>
              ) : null,
            )}
          </Svg>
          <View style={[styles.barOverlay, { width: chart.historyWidth }]}>
            {chart.bars.map((bar) => (
              <Pressable
                key={`tap-${bar.bucket.date}`}
                style={styles.barTap}
                onPress={() => setSelected(bar.bucket)}
                accessibilityRole="button"
                accessibilityLabel={`${shortDate(bar.bucket.date)} sales`}
              />
            ))}
          </View>
          </View>
          {selectedBucket ? (
            <View style={styles.chartDetail}>
              <Text style={styles.detailDate}>{shortDate(selectedBucket.date)}</Text>
              <Text style={styles.detailValue}>
                {metric === 'net' ? 'Net' : 'Gross'} {money(metric === 'net' ? selectedBucket.net : selectedBucket.gross)}
              </Text>
              <Text style={styles.detailMeta}>
                {selectedBucket.orders} order{selectedBucket.orders === 1 ? '' : 's'} ·{' '}
                {money(selectedBucket.refunds)} refunded
              </Text>
            </View>
          ) : null}
          <Text style={styles.chartHint}>Tap a bar for that day’s numbers.</Text>
        </View>

        {forecast?.available ? (
          <View style={styles.forecastCard}>
            <View style={styles.forecastTop}>
              <Text style={styles.cardLabel}>Next {forecast.horizonDays} days</Text>
              <Text
                style={[
                  styles.trend,
                  forecast.trend === 'UP'
                    ? styles.trendUp
                    : forecast.trend === 'DOWN'
                      ? styles.trendDown
                      : undefined,
                ]}
              >
                {forecast.trend === 'UP' ? '↗ Growing' : forecast.trend === 'DOWN' ? '↘ Softening' : '→ Flat'}
              </Text>
            </View>
            <Text style={styles.forecastValue}>{money(forecast.projectedTotal)}</Text>
            <Text style={styles.cardNote}>
              Projected net sales from a least-squares trend over {days} days of history
              ({forecast.slopePerDay >= 0 ? '+' : '−'}
              {money(Math.abs(forecast.slopePerDay))}/day). Estimate only, not a
              guarantee.
            </Text>
          </View>
        ) : (
          <View style={styles.forecastCard}>
            <Text style={styles.cardLabel}>Forecast</Text>
            <Text style={styles.cardNote}>{forecast?.reason ?? 'Not enough data yet.'}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Money</Text>
        <View style={styles.grid}>
          <Tile label="Paid orders" value={String(summary?.paidOrders ?? 0)} />
          <Tile label="Average order" value={money(summary?.averageOrderValue ?? 0)} />
          <Tile label="Refunded" value={String(summary?.refundedOrders ?? 0)} />
          <Tile label="Pending value" value={money(summary?.pendingValue ?? 0)} note="Unpaid orders" />
        </View>

        <Text style={styles.sectionTitle}>Inventory & quotes</Text>
        <View style={styles.grid}>
          <Tile label="Inventory value" value={money(summary?.inventoryValue ?? 0)} note={`${summary?.activeListings ?? 0} live listings`} />
          <Tile label="Low stock" value={String(summary?.lowStockListings ?? 0)} note="3 units or fewer" />
          <Tile label="Quotes sent" value={String(summary?.quotesSent ?? 0)} />
          <Tile label="Quote conversion" value={`${summary?.quoteConversionRate ?? 0}%`} note={`${summary?.quotesAccepted ?? 0} accepted`} />
        </View>

        <Text style={styles.footnote}>
          Figures come from paid parts orders only. Payouts and commissions are not yet
          part of the ledger, so no payout numbers are shown.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {note ? <Text style={styles.tileNote}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  rangeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  hero: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  heroLabel: { ...typography.label, color: palette.textMuted },
  heroValue: {
    fontFamily: fontFamilyMono,
    fontSize: 34,
    color: palette.textPrimary,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  heroMeta: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  metricRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chartCard: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  barOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 14,
    bottom: 26,
    flexDirection: 'row',
  },
  barTap: { flex: 1 },
  chartDetail: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  detailDate: { ...typography.label, color: palette.textMuted },
  detailValue: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: 1 },
  detailMeta: { ...typography.caption, color: palette.textSecondary, marginTop: 1 },
  chartHint: {
    ...typography.label,
    color: palette.textMuted,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  forecastCard: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: palette.accent,
    backgroundColor: palette.surfaceAlt,
    gap: spacing.xs,
  },
  forecastTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardLabel: { ...typography.label, color: palette.textMuted },
  forecastValue: {
    fontFamily: fontFamilyMono,
    fontSize: 22,
    color: palette.textPrimary,
  },
  trend: { ...typography.label, color: palette.textMuted },
  trendUp: { color: palette.success },
  trendDown: { color: palette.warning },
  cardNote: { ...typography.caption, color: palette.textSecondary, lineHeight: 18 },
  sectionTitle: {
    ...typography.captionMedium,
    color: palette.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    width: '50%',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    gap: 2,
  },
  tileLabel: { ...typography.label, color: palette.textMuted },
  tileValue: {
    fontFamily: fontFamilyMono,
    fontSize: 16,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  tileNote: { ...typography.label, color: palette.textMuted },
  footnote: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
