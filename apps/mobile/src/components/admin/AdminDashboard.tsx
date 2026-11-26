import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Activity,
  Bell,
  ChevronRight,
  ClipboardList,
  Landmark,
  ShieldCheck,
} from 'lucide-react-native';
import {
  AppHeader,
  EmptyState,
  PressableScale,
  ScreenContainer,
  Skeleton,
} from '@/components/ui';
import {
  useAdminActivity,
  useAdminActivityStats,
  useAdminOverview,
} from '@/hooks/useAdmin';
import { formatDate, formatRupees as money } from '@/utils/format';
import {
  displayFamily,
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';

function actionLabel(action: string) {
  const [head, ...rest] = action.split(/[._]/);
  return [
    head.charAt(0).toUpperCase() + head.slice(1).toLowerCase(),
    ...rest.map((part) => part.toLowerCase()),
  ].join(' ');
}


function shortDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
  });
}

export function AdminDashboard() {
  const router = useRouter();
  const overview = useAdminOverview();
  const stats = useAdminActivityStats();
  const activity = useAdminActivity({ limit: 5 });

  if (overview.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <AppHeader title="Overview" subtitle="Platform operations" />
        <View style={styles.body}>
          <Skeleton width="100%" height={110} />
          <Skeleton width="100%" height={160} style={{ marginTop: spacing.md }} />
          <Skeleton width="100%" height={160} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader title="Overview" subtitle="Platform operations" />
        <EmptyState
          title="Overview unavailable"
          message="Check your connection and try again."
          action={
            <PressableScale
              onPress={() => void overview.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Retry"
              style={styles.retry}
              scaleTo={0.97}
            >
              <Text style={styles.retryText}>Retry</Text>
            </PressableScale>
          }
        />
      </ScreenContainer>
    );
  }

  const data = overview.data;
  const days = stats.data?.days ?? [];
  const maxDay = Math.max(
    1,
    ...days.map(
      (day) =>
        day.requests + day.bookings + day.quotations + day.sparePartOrders,
    ),
  );
  const quoteRate =
    data.totalQuotations === 0
      ? 0
      : Math.round((data.acceptedQuotations / data.totalQuotations) * 100);

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>Admin</Text>
            <Text style={styles.title}>Overview</Text>
          </View>
          <PressableScale
            onPress={() => router.push('/alerts')}
            accessibilityRole="button"
            accessibilityLabel="Alerts"
            style={styles.headerButton}
            scaleTo={0.92}
          >
            <Bell size={17} color={palette.textSecondary} strokeWidth={1.8} />
          </PressableScale>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Payments collected</Text>
          <Text style={styles.heroValue}>{money(data.totalEscrowVolume)}</Text>
          <Text style={styles.heroMeta}>
            {data.pendingVerifications} providers awaiting verification ·{' '}
            {data.verifiedProviders} verified
          </Text>
        </View>

        <View style={styles.stats}>
          <Stat label="Requests" value={data.totalRequests} />
          <Stat label="Open broadcasts" value={data.openBroadcasts} />
          <Stat label="Bookings" value={data.totalBookings} />
          <Stat label="Completed" value={data.completedBookings} />
          <Stat label="Quotes" value={data.totalQuotations} />
          <Stat label="Quote acceptance" value={`${quoteRate}%`} />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Platform activity</Text>
          <Text style={styles.sectionMeta}>Last 7 days</Text>
        </View>
        {days.length === 0 ? (
          <Text style={styles.emptyLine}>Activity data is loading.</Text>
        ) : (
          <View style={styles.chart}>
            {days.map((day) => {
              const total =
                day.requests +
                day.bookings +
                day.quotations +
                day.sparePartOrders;
              return (
                <View key={day.date} style={styles.chartCol}>
                  <View style={styles.chartTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: Math.max(4, (total / maxDay) * 84),
                          backgroundColor:
                            day.date === days[days.length - 1].date
                              ? palette.accent
                              : palette.borderStrong,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{shortDate(day.date)}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Queues</Text>
        </View>
        <ActionRow
          icon={<ShieldCheck size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Provider verification"
          detail={`${data.pendingVerifications} pending`}
          onPress={() => router.push('/providers')}
        />
        <ActionRow
          icon={<ClipboardList size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Orders and jobs"
          detail="Refunds, disputes and fulfillment"
          onPress={() => router.push('/operations')}
        />
        <ActionRow
          icon={<Landmark size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Payment ledger"
          detail="Held, released and refunded payments"
          onPress={() => router.push('/escrow')}
        />
        <ActionRow
          icon={<Activity size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Activity log"
          detail="Audit trail across the platform"
          onPress={() => router.push('/activity')}
        />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <PressableScale
            onPress={() => router.push('/activity')}
            accessibilityRole="link"
            accessibilityLabel="View all activity"
            scaleTo={0.95}
          >
            <Text style={styles.sectionMeta}>View all</Text>
          </PressableScale>
        </View>
        {(activity.data?.items ?? []).length === 0 ? (
          <Text style={styles.emptyLine}>No activity recorded yet.</Text>
        ) : (
          (activity.data?.items ?? []).map((log, index) => (
            <View key={log.id} style={[styles.logRow, index > 0 && styles.divider]}>
              <View style={styles.logText}>
                <Text style={styles.logAction}>{actionLabel(log.action)}</Text>
                <Text style={styles.logMeta} numberOfLines={1}>
                  {log.actorRole?.toLowerCase() ?? 'system'}
                  {log.entityType ? ` · ${log.entityType}` : ''}
                </Text>
              </View>
              <Text style={styles.logDate}>{formatDate(log.createdAt)}</Text>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          {stats.data?.totals.users ?? 0} users ·{' '}
          {stats.data?.totals.providers ?? 0} providers
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  eyebrow: { ...typography.label, color: palette.textMuted, letterSpacing: 0.3 },
  title: {
    fontFamily: displayFamily,
    fontSize: 32,
    lineHeight: 38,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
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
  hero: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  heroLabel: { ...typography.label, color: palette.textMuted },
  heroValue: {
    fontFamily: fontFamilyMono,
    fontSize: 32,
    color: palette.textPrimary,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  heroMeta: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  stat: { width: '33.33%', paddingVertical: spacing.md, gap: 2 },
  statValue: {
    fontFamily: fontFamilyMono,
    fontSize: 18,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...typography.label, color: palette.textMuted },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.captionMedium, color: palette.textPrimary },
  sectionMeta: { ...typography.label, color: palette.textMuted },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartTrack: { height: 88, justifyContent: 'flex-end', width: '100%' },
  chartBar: { width: '100%', borderRadius: 2 },
  chartLabel: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
  },
  emptyLine: {
    ...typography.caption,
    color: palette.textMuted,
    paddingVertical: spacing.md,
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
  actionIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  actionDetail: { ...typography.label, color: palette.textMuted, marginTop: 1 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  logText: { flex: 1 },
  logAction: { ...typography.bodyMedium, color: palette.textPrimary },
  logMeta: { ...typography.label, color: palette.textMuted, marginTop: 2 },
  logDate: { ...typography.label, color: palette.textMuted },
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
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  retryText: { ...typography.label, color: palette.textPrimary },
});
