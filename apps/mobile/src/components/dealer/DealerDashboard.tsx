import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Bell,
  ChevronRight,
  MessageCircle,
  Package,
  Radar,
  Tag,
  TriangleAlert,
  Wallet,
} from 'lucide-react-native';
import {
  EmptyState,
  PressableScale,
  ScreenContainer,
  SectionHead,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useProviderDashboard } from '@/hooks/useProviderDashboard';
import { useUpdateProviderProfile } from '@/hooks/useProfile';
import {
  displayFamily,
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';
import { formatDate } from '@/utils/format';
import { useState } from 'react';

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function StatBlock({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | number;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.stat}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      scaleTo={0.98}
      style={styles.stat}
    >
      {content}
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
      <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

export function DealerDashboard() {
  const router = useRouter();
  const { user, providerProfile } = useAuth();
  const query = useProviderDashboard();
  const updateProfile = useUpdateProviderProfile();
  const [toggleError, setToggleError] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <View style={styles.body}>
          <Skeleton width="60%" height={30} />
          <Skeleton width="100%" height={92} style={{ marginTop: spacing.lg }} />
          <Skeleton width="100%" height={160} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <View style={styles.body}>
          <EmptyState
            title="Dashboard unavailable"
            message="Check your connection and try again."
            action={
              <PressableScale
                onPress={() => void query.refetch()}
                accessibilityRole="button"
                accessibilityLabel="Retry"
                style={styles.retry}
                scaleTo={0.97}
              >
                <Text style={styles.retryText}>Retry</Text>
              </PressableScale>
            }
          />
        </View>
      </ScreenContainer>
    );
  }

  const data = query.data;
  const verified = data.provider.verificationStatus === 'VERIFIED';
  const name =
    data.provider.businessName ||
    providerProfile?.businessName ||
    user?.email?.split('@')[0] ||
    'Dealer';
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

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>Dealer</Text>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <PressableScale
              onPress={() => router.push('/alerts')}
              accessibilityRole="button"
              accessibilityLabel="Alerts"
              style={styles.headerButton}
              scaleTo={0.92}
            >
              <Bell size={17} color={palette.textSecondary} strokeWidth={1.8} />
            </PressableScale>
            <PressableScale
              onPress={() => router.push('/inbox')}
              accessibilityRole="button"
              accessibilityLabel="Messages"
              style={styles.headerButton}
              scaleTo={0.92}
            >
              <MessageCircle size={17} color={palette.textSecondary} strokeWidth={1.8} />
            </PressableScale>
          </View>
        </View>

        <View style={styles.verifiedRow}>
          <StatusPill label={data.provider.verificationStatus} tone={verificationTone} />
          <Text style={styles.meta}>
            {data.provider.avgRating > 0
              ? `${data.provider.avgRating.toFixed(1)} rating · ${data.provider.totalReviews} reviews`
              : 'New dealer'}
          </Text>
        </View>

        <PressableScale
          onPress={() => void toggleAvailability()}
          disabled={updateProfile.isPending}
          accessibilityRole="switch"
          accessibilityState={{ checked: data.provider.isAvailable }}
          accessibilityLabel="Accepting orders"
          style={[styles.availability, data.provider.isAvailable && styles.availabilityOn]}
          scaleTo={0.99}
        >
          <View style={styles.availabilityText}>
            <Text style={styles.availabilityTitle}>
              {data.provider.isAvailable ? 'Accepting orders' : 'Shop closed'}
            </Text>
            <Text style={styles.availabilityDetail}>
              {data.provider.isAvailable
                ? 'Customers can buy your active listings.'
                : 'Your listings stay visible but cannot be ordered.'}
            </Text>
          </View>
          {updateProfile.isPending ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <View style={[styles.toggle, data.provider.isAvailable && styles.toggleOn]}>
              <Text style={[styles.toggleText, data.provider.isAvailable && styles.toggleTextOn]}>
                {data.provider.isAvailable ? 'On' : 'Off'}
              </Text>
            </View>
          )}
        </PressableScale>
        {!verified ? (
          <Text style={styles.notice}>
            Your account is {data.provider.verificationStatus.toLowerCase()}. You
            cannot accept orders until approval.
          </Text>
        ) : null}
        {toggleError ? <Text style={styles.error}>{toggleError}</Text> : null}

        <View style={styles.stats}>
          <StatBlock
            label="Open requests"
            value={data.counts.openRequests}
            onPress={() => router.push('/opportunities')}
          />
          <StatBlock
            label="Quotes"
            value={data.counts.pendingQuotes}
            onPress={() => router.push('/my-quotes')}
          />
          <StatBlock
            label="To fulfill"
            value={data.counts.pendingOrders}
            onPress={() => router.push('/orders')}
          />
          <StatBlock
            label="Listings"
            value={data.counts.activeListings}
            onPress={() => router.push('/my-listings')}
          />
        </View>

        <View style={styles.moneyRow}>
          <View style={styles.moneyBlock}>
            <Text style={styles.moneyValue}>{money(data.revenue.paidTotal)}</Text>
            <Text style={styles.moneyLabel}>Paid sales</Text>
          </View>
          <View style={styles.moneyBlock}>
            <Text style={styles.moneyValue}>{money(data.revenue.todayPaid)}</Text>
            <Text style={styles.moneyLabel}>Today</Text>
          </View>
          <View style={styles.moneyBlock}>
            <Text style={styles.moneyValue}>{money(data.revenue.inventoryValue)}</Text>
            <Text style={styles.moneyLabel}>Inventory value</Text>
          </View>
        </View>

        <SectionHead title="Needs attention" />
        {attention.length === 0 ? (
          <Text style={styles.emptyLine}>All clear. Nothing needs action.</Text>
        ) : (
          attention.map((item) => (
            <PressableScale
              key={item.key}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={styles.attentionRow}
              scaleTo={0.99}
            >
              <TriangleAlert size={15} color={palette.textMuted} strokeWidth={1.8} />
              <Text style={styles.attentionText}>{item.label}</Text>
              <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
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
              onPress={() => router.push('/orders')}
              accessibilityRole="button"
              accessibilityLabel={`Order ${order.sparePart?.name ?? ''}`}
              style={[styles.dataRow, index > 0 && styles.divider]}
              scaleTo={0.99}
            >
              <View style={styles.dataText}>
                <Text style={styles.dataTitle} numberOfLines={1}>
                  {order.sparePart?.name ?? 'Spare part'}
                </Text>
                <Text style={styles.dataMeta} numberOfLines={1}>
                  {order.customer?.firstName ?? 'Customer'} · {order.fulfillmentStatus.toLowerCase()}
                </Text>
              </View>
              <View style={styles.dataRight}>
                <Text style={styles.dataAmount}>{money(order.totalAmount)}</Text>
                <Text style={styles.dataMeta}>{formatDate(order.createdAt)}</Text>
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
              accessibilityLabel={`Quote ${quote.request?.title ?? ''}`}
              style={[styles.dataRow, index > 0 && styles.divider]}
              scaleTo={0.99}
            >
              <View style={styles.dataText}>
                <Text style={styles.dataTitle} numberOfLines={1}>
                  {quote.request?.title ?? 'Service request'}
                </Text>
                <Text style={styles.dataMeta}>{quote.status.toLowerCase()}</Text>
              </View>
              <View style={styles.dataRight}>
                <Text style={styles.dataAmount}>{money(quote.totalCost)}</Text>
                <Text style={styles.dataMeta}>{formatDate(quote.createdAt)}</Text>
              </View>
            </PressableScale>
          ))
        )}

        <SectionHead title="Manage" />
        <ActionRow
          icon={<Radar size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Requests"
          detail="Open spare-part requests near you"
          onPress={() => router.push('/opportunities')}
        />
        <ActionRow
          icon={<Package size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Orders"
          detail="Fulfill paid customer orders"
          onPress={() => router.push('/orders')}
        />
        <ActionRow
          icon={<Tag size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Listings"
          detail="Manage parts, price and stock"
          onPress={() => router.push('/my-listings')}
        />
        <ActionRow
          icon={<BarChart3 size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Financials"
          detail="Sales trend, refunds and forecast"
          onPress={() => router.push('/financials')}
        />
        <ActionRow
          icon={<Wallet size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Quotes"
          detail="Sent quotes and their status"
          onPress={() => router.push('/my-quotes')}
        />
        <ActionRow
          icon={<MessageCircle size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Messages"
          detail="Customer conversations"
          onPress={() => router.push('/inbox')}
        />

        <Text style={styles.footer}>
          {data.provider.serviceRadiusKm} km service radius · Hyderabad pilot
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.3,
  },
  name: {
    fontFamily: displayFamily,
    fontSize: 30,
    lineHeight: 34,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  meta: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
  },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
  },
  availabilityOn: {
    borderLeftColor: palette.accent,
  },
  availabilityText: { flex: 1 },
  availabilityTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  availabilityDetail: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  toggle: {
    minWidth: 44,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  toggleOn: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  toggleText: { ...typography.label, color: palette.textSecondary },
  toggleTextOn: { color: palette.onAccent },
  notice: {
    ...typography.caption,
    color: palette.warning,
    marginTop: spacing.xs,
  },
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.xs },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  stat: {
    width: '50%',
    paddingVertical: spacing.md,
    gap: 2,
  },
  statValue: {
    fontFamily: fontFamilyMono,
    fontSize: 20,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...typography.label, color: palette.textMuted },
  moneyRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  moneyBlock: { flex: 1, gap: 2 },
  moneyValue: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  moneyLabel: { ...typography.label, color: palette.textMuted },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  attentionText: {
    ...typography.body,
    color: palette.textPrimary,
    flex: 1,
  },
  emptyLine: {
    ...typography.caption,
    color: palette.textMuted,
    paddingVertical: spacing.md,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  dataText: { flex: 1 },
  dataTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  dataMeta: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
  dataRight: { alignItems: 'flex-end' },
  dataAmount: {
    fontFamily: fontFamilyMono,
    fontSize: 12,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  actionIcon: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  actionDetail: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
  footer: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: palette.accent,
  },
  retryText: { ...typography.label, color: palette.onAccent },
});
