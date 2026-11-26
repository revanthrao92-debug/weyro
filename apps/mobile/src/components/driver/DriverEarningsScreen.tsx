import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, ErrorState, PageHeader, ScreenContainer, Skeleton } from '@/components/ui';
import { EarningsChart } from '@/components/dealer/EarningsChart';
import { useDriverEarnings } from '@/hooks/useDriverGo';
import { useProviderAnalytics } from '@/hooks/useProviderAnalytics';
import { useRefreshControl } from '@/hooks/useRefreshControl';
import { palette, radii, spacing, typography } from '@/theme';
import { money } from './driverFormat';
import { TripRow } from './TripCards';

const RANGES = [7, 30, 90] as const;

/** Driver earnings: totals, the daily graph with a forecast, and finished trips. */
export function DriverEarningsScreen() {
  const router = useRouter();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const query = useDriverEarnings();
  const analytics = useProviderAnalytics(days);
  const refreshControl = useRefreshControl(() => Promise.all([query.refetch(), analytics.refetch()]));
  const sales = analytics.data;
  const forecast = sales?.forecast.available ? sales.forecast : null;
  const trips = (query.data?.trips ?? []).filter((trip) => trip.status === 'COMPLETED');

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        <PageHeader title="Earnings" subtitle="Your share of each finished trip" />

        {query.isError ? (
          <ErrorState message="Check your connection and try again." onRetry={() => void query.refetch()} />
        ) : (
          <View style={styles.totals}>
            {[
              ['Today', query.data?.today],
              ['This week', query.data?.week],
              ['This month', query.data?.month],
            ].map(([label, value]) => (
              <View key={label as string} style={styles.total}>
                {query.isLoading ? <Skeleton width={70} height={22} /> : <Text style={styles.totalValue}>{money(Number(value ?? 0))}</Text>}
                <Text style={styles.totalLabel}>{label}</Text>
              </View>
            ))}
          </View>
        )}

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
          {analytics.isLoading ? (
            <Skeleton width="100%" height={260} />
          ) : sales && sales.buckets.length > 0 ? (
            <EarningsChart
              buckets={sales.buckets}
              forecast={forecast?.points}
              idle={{
                label: `Last ${days} days`,
                value: money(sales.summary.netSales),
                meta: `${sales.summary.paidOrders} trip${sales.summary.paidOrders === 1 ? '' : 's'}. Drag along the line to see each day.`,
              }}
              accessibilityLabel={`Earnings chart. Last ${days} days ${money(sales.summary.netSales)} from ${sales.summary.paidOrders} trips.${
                forecast ? ` Next ${forecast.horizonDays} days about ${money(forecast.projectedTotal)}.` : ''
              }`}
            />
          ) : (
            <Text style={styles.empty}>Your earnings show here after your first trip.</Text>
          )}
          {forecast ? (
            <Text style={styles.forecast}>
              Next {forecast.horizonDays} days: about {money(forecast.projectedTotal)}, likely {money(forecast.projectedLow)} to{' '}
              {money(forecast.projectedHigh)}.
            </Text>
          ) : sales && !sales.forecast.available ? (
            <Text style={styles.forecast}>{sales.forecast.reason}</Text>
          ) : null}
        </View>

        <Text style={styles.note}>
          Amounts are after the 18% platform fee. During the pilot, the Weyro team releases payouts every week.
        </Text>

        <Text style={styles.section}>Finished trips</Text>
        {query.isLoading ? (
          <Skeleton width="100%" height={60} />
        ) : trips.length === 0 ? (
          <Text style={styles.empty}>No finished trips yet.</Text>
        ) : (
          trips.map((trip, i) => (
            <View key={trip.id} style={i > 0 ? styles.divider : undefined}>
              <TripRow job={trip} onPress={() => router.push(`/driver-booking/${trip.id}`)} />
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  totals: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  total: { flex: 1 },
  totalValue: { ...typography.heading, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  totalLabel: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  ranges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  forecast: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  note: { ...typography.caption, color: palette.textMuted, marginTop: spacing.md },
  section: { ...typography.section, color: palette.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  empty: { ...typography.caption, color: palette.textMuted, paddingVertical: spacing.md },
});
