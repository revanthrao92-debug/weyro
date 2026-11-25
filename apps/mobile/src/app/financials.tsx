import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip, ErrorState, PageHeader, ScreenContainer, Skeleton } from '@/components/ui';
import { EarningsChart } from '@/components/dealer/EarningsChart';
import { useProviderAnalytics } from '@/hooks/useProviderAnalytics';
import { useRefreshControl } from '@/hooks/useRefreshControl';
import { palette, radii, spacing, typography } from '@/theme';
import { compactRupees } from '@/utils/earningsChart';

const RANGES = [7, 30, 90] as const;

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${compactRupees(Math.abs(value))}`;

export default function FinancialsScreen() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, isLoading, isError, refetch } = useProviderAnalytics(days);
  const refreshControl = useRefreshControl(refetch);

  const header = <PageHeader back title="Earnings" subtitle="Your sales and the next 14 days" />;

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        {header}
        <Skeleton width="100%" height={300} />
        <Skeleton width="100%" height={160} style={{ marginTop: spacing.md }} />
      </ScreenContainer>
    );
  }

  if (isError || !data) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        {header}
        <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
      </ScreenContainer>
    );
  }

  const { summary, buckets, forecast } = data;
  const fc = forecast.available ? forecast : null;
  const biggest = fc ? Math.max(1, ...fc.factors.map((f) => Math.abs(f.amount))) : 1;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        {header}

        <View style={styles.ranges}>
          {RANGES.map((range) => (
            <Chip
              key={range}
              label={`${range} days`}
              accessibilityLabel={`Show the last ${range} days`}
              selected={days === range}
              onPress={() => setDays(range)}
            />
          ))}
        </View>

        <View style={styles.card}>
          <EarningsChart
            buckets={buckets}
            forecast={fc?.points}
            idle={{
              label: `Last ${days} days`,
              value: money(summary.netSales),
              meta: `${summary.paidOrders} orders, ${money(summary.refundAmount)} refunded. Drag along the line to see each day.`,
            }}
            accessibilityLabel={`Earnings chart. Last ${days} days ${money(summary.netSales)} from ${summary.paidOrders} orders.${
              fc ? ` Next ${fc.horizonDays} days about ${money(fc.projectedTotal)}.` : ''
            }`}
          />
        </View>

        {fc ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Next {fc.horizonDays} days</Text>
              <Text style={styles.big}>About {money(fc.projectedTotal)}</Text>
              <Text style={styles.cardText}>
                Likely between {money(fc.projectedLow)} and {money(fc.projectedHigh)}.
              </Text>
              <Text style={styles.cardNote}>
                {fc.accuracy
                  ? `Checked against your own past sales ${fc.accuracy.checks} times: usually within ${fc.accuracy.withinPct}%.`
                  : 'Accuracy shows here once there are about 7 weeks of sales to check against.'}
              </Text>
            </View>

            <Text style={styles.section}>Why this forecast</Text>
            <Text style={styles.sectionNote}>What moves the next {fc.horizonDays} days, biggest first.</Text>
            {fc.factors.map((f, i) => (
              <View
                key={f.key}
                style={[styles.factor, i > 0 && styles.divider]}
                accessible
                accessibilityLabel={`${f.label}: ${f.amount >= 0 ? 'adds' : 'takes off'} about ${money(Math.abs(f.amount))}. ${f.detail}`}
              >
                <View style={styles.factorTop}>
                  <Text style={styles.factorLabel}>{f.label}</Text>
                  <Text style={styles.factorAmount}>
                    {Math.abs(f.amount) < Math.max(100, fc.projectedTotal * 0.01) ? 'Small' : signed(f.amount)}
                  </Text>
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${Math.max(2, (Math.abs(f.amount) / biggest) * 100)}%` },
                      f.amount >= 0 ? styles.barUp : styles.barDown,
                    ]}
                  />
                </View>
                <Text style={styles.factorDetail}>{f.detail}</Text>
              </View>
            ))}

            {fc.skipped.length > 0 ? (
              <>
                <Text style={styles.section}>Not included</Text>
                {fc.skipped.map((s, i) => (
                  <View key={s.key} style={[styles.skip, i > 0 && styles.divider]}>
                    <Text style={styles.skipLabel}>{s.label}</Text>
                    <Text style={styles.factorDetail}>{s.reason}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Forecast</Text>
            <Text style={styles.cardText}>{forecast.available ? '' : forecast.reason}</Text>
          </View>
        )}

        <Text style={styles.section}>Money</Text>
        <View style={styles.grid}>
          <Tile label="Paid orders" value={String(summary.paidOrders)} />
          <Tile label="Average order" value={money(summary.averageOrderValue)} />
          <Tile label="Refunded orders" value={String(summary.refundedOrders)} />
          <Tile label="Waiting for payment" value={money(summary.pendingValue)} />
        </View>

        <Text style={styles.section}>Stock and quotes</Text>
        <View style={styles.grid}>
          <Tile label="Stock value" value={money(summary.inventoryValue)} note={`${summary.activeListings} live listings`} />
          <Tile label="Low on stock" value={String(summary.lowStockListings)} note="3 or fewer left" />
          <Tile label="Quotes sent" value={String(summary.quotesSent)} />
          <Tile label="Quotes won" value={`${summary.quoteConversionRate}%`} note={`${summary.quotesAccepted} accepted`} />
        </View>

        <Text style={styles.footnote}>
          From paid parts orders only. The forecast is an estimate from your own sales, not a promise.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {note ? <Text style={styles.tileNote}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  ranges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  cardLabel: { ...typography.caption, color: palette.textMuted },
  big: { ...typography.title, color: palette.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  cardText: { ...typography.body, color: palette.textSecondary, marginTop: spacing.xs },
  cardNote: { ...typography.caption, color: palette.textMuted, marginTop: spacing.sm },
  section: { ...typography.section, color: palette.textPrimary, marginTop: spacing.xl },
  sectionNote: { ...typography.caption, color: palette.textMuted, marginTop: 2, marginBottom: spacing.sm },
  factor: { paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  factorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  factorLabel: { ...typography.bodyMedium, color: palette.textPrimary, flex: 1 },
  factorAmount: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: palette.surfaceAlt, marginTop: spacing.sm, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  barUp: { backgroundColor: palette.success },
  barDown: { backgroundColor: palette.danger },
  factorDetail: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
  skip: { paddingVertical: spacing.sm },
  skipLabel: { ...typography.captionMedium, color: palette.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  tile: {
    width: '50%',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  tileValue: { ...typography.heading, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  tileLabel: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  tileNote: { ...typography.caption, color: palette.textMuted },
  footnote: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xl },
});
