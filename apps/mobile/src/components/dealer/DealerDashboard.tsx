import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  ChevronRight,
  MessageCircle,
  Package,
  Radar,
  Tag,
  TriangleAlert,
  Wallet,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ErrorState,
  FadeSlideIn,
  PressableScale,
  ScreenContainer,
  SectionHead,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { TopBar } from '@/components/home/customer/TopBar';
import { EarningsChart } from './EarningsChart';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useProviderAnalytics } from '@/hooks/useProviderAnalytics';
import { useProviderDashboard } from '@/hooks/useProviderDashboard';
import { useUpdateProviderProfile } from '@/hooks/useProfile';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';
import { compactRupees } from '@/utils/earningsChart';
import { formatDate, labelize } from '@/utils/format';

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

const stagger = (i: number) => 60 + i * 70;

function StatBlock({ label, value, onPress }: { label: string; value: string | number; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      scaleTo={0.98}
      style={styles.stat}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </PressableScale>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.99}
      style={styles.actionRow}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionText}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

export function DealerDashboard() {
  const router = useRouter();
  const { user, providerProfile } = useAuth();
  const query = useProviderDashboard();
  const analytics = useProviderAnalytics(30);
  const { unreadCount } = useNotifications();
  const updateProfile = useUpdateProviderProfile();
  const [toggleError, setToggleError] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <View style={styles.loading}>
          <Skeleton width="70%" height={34} />
          <Skeleton width="100%" height={72} style={{ marginTop: spacing.lg }} />
          <Skeleton width="100%" height={220} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <ErrorState
          title="Dashboard unavailable"
          message="Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      </ScreenContainer>
    );
  }

  const data = query.data;
  const verified = data.provider.verificationStatus === 'VERIFIED';
  const name =
    data.provider.businessName || providerProfile?.businessName || user?.email?.split('@')[0] || 'Dealer';
  const verificationTone =
    data.provider.verificationStatus === 'VERIFIED'
      ? 'success'
      : data.provider.verificationStatus === 'PENDING'
        ? 'warning'
        : 'danger';

  const attention = [
    {
      key: 'orders',
      show: data.counts.pendingOrders > 0,
      label: `${data.counts.pendingOrders} paid order${data.counts.pendingOrders === 1 ? '' : 's'} to fulfill`,
      onPress: () => router.push('/orders'),
    },
    {
      key: 'requests',
      show: data.counts.openRequests > 0,
      label: `${data.counts.openRequests} open request${data.counts.openRequests === 1 ? '' : 's'} near you`,
      onPress: () => router.push('/opportunities'),
    },
    {
      key: 'stock',
      show: data.counts.lowStock > 0,
      label: `${data.counts.lowStock} listing${data.counts.lowStock === 1 ? '' : 's'} low on stock`,
      onPress: () => router.push('/my-listings'),
    },
    {
      key: 'quotes',
      show: data.counts.pendingQuotes > 0,
      label: `${data.counts.pendingQuotes} pending quote${data.counts.pendingQuotes === 1 ? '' : 's'}`,
      onPress: () => router.push('/my-quotes'),
    },
  ].filter((item) => item.show);

  const toggleAvailability = async () => {
    if (!verified) {
      setToggleError('Verification must be approved before accepting orders.');
      return;
    }
    setToggleError(null);
    try {
      await updateProfile.mutateAsync({ isAvailable: !data.provider.isAvailable });
      await query.refetch();
    } catch (e: any) {
      setToggleError(e?.message || 'Could not update availability.');
    }
  };

  const sales = analytics.data;
  const forecast = sales?.forecast.available ? sales.forecast : null;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <TopBar router={router} user={user} unreadCount={unreadCount} initial={name[0]} />

        <View style={styles.body}>
          <FadeSlideIn delay={stagger(0)}>
            <Text style={styles.name} numberOfLines={2} accessibilityRole="header">
              {name}
            </Text>
            <View style={styles.verifiedRow}>
              <StatusPill label={labelize(data.provider.verificationStatus)} tone={verificationTone} />
              <Text style={styles.meta}>
                {data.provider.avgRating > 0
                  ? `${data.provider.avgRating.toFixed(1)} rating, ${data.provider.totalReviews} reviews`
                  : 'New dealer'}
              </Text>
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={stagger(1)}>
            <View style={styles.card}>
              <View style={styles.availabilityRow}>
                <View style={styles.availabilityText}>
                  <Text style={styles.cardTitle}>
                    {data.provider.isAvailable ? 'Accepting orders' : 'Shop closed'}
                  </Text>
                  <Text style={styles.cardDetail}>
                    {data.provider.isAvailable
                      ? 'Customers can buy your active listings.'
                      : 'Your listings stay visible but cannot be ordered.'}
                  </Text>
                </View>
                {updateProfile.isPending ? (
                  <ActivityIndicator color={palette.accent} />
                ) : (
                  <Switch
                    value={data.provider.isAvailable}
                    onValueChange={() => void toggleAvailability()}
                    trackColor={{ true: palette.accent, false: palette.borderStrong }}
                    thumbColor="#FFFFFF"
                    // web-only prop (react-native-web defaults it to teal), missing from the RN types
                    {...({ activeThumbColor: '#FFFFFF' } as object)}
                    accessibilityLabel="Accepting orders"
                  />
                )}
              </View>
              {!verified ? (
                <Text style={styles.notice}>
                  Your account is {data.provider.verificationStatus.toLowerCase()}. You cannot accept orders until
                  approval.
                </Text>
              ) : null}
              {toggleError ? <Text style={styles.error}>{toggleError}</Text> : null}
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={stagger(2)}>
            <SectionHead title="Earnings" action="Details" onAction={() => router.push('/financials')} />
            <View style={[styles.card, styles.cardAfterHead]}>
              {analytics.isLoading ? (
                <Skeleton width="100%" height={210} />
              ) : sales && sales.buckets.length > 0 ? (
                <EarningsChart
                  compact
                  buckets={sales.buckets}
                  forecast={forecast?.points}
                  idle={{
                    label: 'Last 30 days',
                    value: money(sales.summary.netSales),
                    meta: `${sales.summary.paidOrders} paid orders. Drag along the line to see each day.`,
                  }}
                  accessibilityLabel={`Earnings chart. Last 30 days ${money(sales.summary.netSales)} from ${
                    sales.summary.paidOrders
                  } orders.${forecast ? ` Next ${forecast.horizonDays} days, about ${money(forecast.projectedTotal)}.` : ''}`}
                />
              ) : (
                <Text style={styles.emptyLine}>Your earnings will show here after your first sale.</Text>
              )}
              {forecast ? (
                <PressableScale
                  onPress={() => router.push('/financials')}
                  accessibilityRole="button"
                  accessibilityLabel={`Forecast: next ${forecast.horizonDays} days about ${money(
                    forecast.projectedTotal,
                  )}, likely ${money(forecast.projectedLow)} to ${money(forecast.projectedHigh)}`}
                  scaleTo={0.99}
                  style={styles.forecastRow}
                >
                  <View style={styles.legendDash} />
                  <Text style={styles.forecastText}>
                    Next {forecast.horizonDays} days: about{' '}
                    <Text style={styles.forecastStrong}>{compactRupees(forecast.projectedTotal)}</Text>, likely{' '}
                    {compactRupees(forecast.projectedLow)} to {compactRupees(forecast.projectedHigh)}
                  </Text>
                  <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
                </PressableScale>
              ) : sales && !sales.forecast.available ? (
                <Text style={styles.cardDetail}>{sales.forecast.reason}</Text>
              ) : null}
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={stagger(3)}>
            <View style={styles.stats}>
              <StatBlock label="To fulfill" value={data.counts.pendingOrders} onPress={() => router.push('/orders')} />
              <StatBlock
                label="Open requests"
                value={data.counts.openRequests}
                onPress={() => router.push('/opportunities')}
              />
              <StatBlock label="Quotes" value={data.counts.pendingQuotes} onPress={() => router.push('/my-quotes')} />
              <StatBlock
                label="Listings"
                value={data.counts.activeListings}
                onPress={() => router.push('/my-listings')}
              />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{money(data.revenue.todayPaid)}</Text>
                <Text style={styles.statLabel}>Sales today</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{money(data.revenue.inventoryValue)}</Text>
                <Text style={styles.statLabel}>Stock value</Text>
              </View>
            </View>
          </FadeSlideIn>

          <SectionHead title="Needs attention" />
          {attention.length === 0 ? (
            <Text style={styles.emptyLine}>All clear. Nothing needs action.</Text>
          ) : (
            attention.map((item, index) => (
              <PressableScale
                key={item.key}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={[styles.row, index > 0 && styles.divider]}
                scaleTo={0.99}
              >
                <TriangleAlert size={18} color={palette.warning} strokeWidth={1.8} />
                <Text style={styles.rowText}>{item.label}</Text>
                <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
              </PressableScale>
            ))
          )}

          <SectionHead
            title="Recent orders"
            action={data.recentOrders.length > 0 ? 'View all' : undefined}
            onAction={() => router.push('/orders')}
          />
          {data.recentOrders.length === 0 ? (
            <Text style={styles.emptyLine}>No orders yet.</Text>
          ) : (
            data.recentOrders.map((order, index) => (
              <PressableScale
                key={order.id}
                onPress={() => router.push(`/order/${order.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Order ${order.sparePart?.name ?? ''}, ${money(order.totalAmount)}`}
                style={[styles.row, index > 0 && styles.divider]}
                scaleTo={0.99}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {order.sparePart?.name ?? 'Spare part'}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {order.customer?.firstName ?? 'Customer'}, {formatDate(order.createdAt)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.amount}>{money(order.totalAmount)}</Text>
                  <Text style={styles.rowMeta}>{labelize(order.fulfillmentStatus)}</Text>
                </View>
              </PressableScale>
            ))
          )}

          <SectionHead
            title="Recent quotes"
            action={data.recentQuotes.length > 0 ? 'View all' : undefined}
            onAction={() => router.push('/my-quotes')}
          />
          {data.recentQuotes.length === 0 ? (
            <Text style={styles.emptyLine}>No quotes sent yet.</Text>
          ) : (
            data.recentQuotes.map((quote, index) => (
              <PressableScale
                key={quote.id}
                onPress={() => router.push('/my-quotes')}
                accessibilityRole="button"
                accessibilityLabel={`Quote ${quote.request?.title ?? ''}, ${money(quote.totalCost)}`}
                style={[styles.row, index > 0 && styles.divider]}
                scaleTo={0.99}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {quote.request?.title ?? 'Service request'}
                  </Text>
                  <Text style={styles.rowMeta}>{formatDate(quote.createdAt)}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.amount}>{money(quote.totalCost)}</Text>
                  <Text style={styles.rowMeta}>{labelize(quote.status)}</Text>
                </View>
              </PressableScale>
            ))
          )}

          <SectionHead title="Manage" />
          <ActionRow
            icon={<Radar size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Requests"
            detail="Open spare-part requests near you"
            onPress={() => router.push('/opportunities')}
          />
          <ActionRow
            icon={<Package size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Orders"
            detail="Fulfill paid customer orders"
            onPress={() => router.push('/orders')}
          />
          <ActionRow
            icon={<Tag size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Listings"
            detail="Manage parts, price and stock"
            onPress={() => router.push('/my-listings')}
          />
          <ActionRow
            icon={<BarChart3 size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Earnings and forecast"
            detail="Daily sales, refunds and the next 14 days"
            onPress={() => router.push('/financials')}
          />
          <ActionRow
            icon={<Wallet size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Quotes"
            detail="Sent quotes and their status"
            onPress={() => router.push('/my-quotes')}
          />
          <ActionRow
            icon={<MessageCircle size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Messages"
            detail="Customer conversations"
            onPress={() => router.push('/inbox')}
          />

          <Text style={styles.footer}>{data.provider.serviceRadiusKm} km service radius</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: spacing.xxl },
  body: { paddingHorizontal: spacing.lg },
  loading: { paddingTop: spacing.lg },
  name: { fontFamily: displayFamily, fontSize: 28, lineHeight: 34, color: palette.textPrimary, marginTop: spacing.sm },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  meta: { ...typography.caption, color: palette.textMuted },
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  cardAfterHead: { marginTop: 0 },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  availabilityText: { flex: 1 },
  cardTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  cardDetail: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  notice: { ...typography.caption, color: palette.warning, marginTop: spacing.sm },
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.sm },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  legendDash: { width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: palette.accent },
  forecastText: { ...typography.caption, color: palette.textSecondary, flex: 1 },
  forecastStrong: { ...typography.captionMedium, color: palette.textPrimary },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  stat: {
    width: '50%',
    minHeight: 64,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  statValue: { ...typography.heading, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  rowText: { ...typography.body, color: palette.textPrimary, flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  rowMeta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  amount: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  actionIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  actionDetail: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  footer: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xl, textAlign: 'center' },
  emptyLine: { ...typography.caption, color: palette.textMuted, paddingVertical: spacing.md },
});
