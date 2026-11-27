import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Activity, ChevronRight, ClipboardList, Landmark, ShieldCheck } from 'lucide-react-native';
import { ErrorState, PressableScale, ScreenContainer, SectionHead, Skeleton } from '@/components/ui';
import { TopBar } from '@/components/home/customer/TopBar';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useRefreshControl } from '@/hooks/useRefreshControl';
import { useAdminActivity, useAdminActivityStats, useAdminOverview } from '@/hooks/useAdmin';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';
import { formatRupees as money } from '@/utils/format';
import { ActivityChart } from './ActivityChart';
import { actionLabel, whenShort } from './activityFormat';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionRow({ icon, label, detail, onPress }: { icon: React.ReactNode; label: string; detail: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.99} style={styles.actionRow}>
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionText}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

/** Admin home: money in, what needs attention, and the last week of activity. */
export function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const overview = useAdminOverview();
  const stats = useAdminActivityStats();
  const activity = useAdminActivity({ limit: 5 });
  const refreshControl = useRefreshControl(() => Promise.all([overview.refetch(), stats.refetch(), activity.refetch()]));

  if (overview.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <View style={styles.loading}>
          <Skeleton width="60%" height={34} />
          <Skeleton width="100%" height={110} style={{ marginTop: spacing.lg }} />
          <Skeleton width="100%" height={200} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <ErrorState title="Overview unavailable" message="Check your connection and try again." onRetry={() => void overview.refetch()} />
      </ScreenContainer>
    );
  }

  const data = overview.data;
  // Older servers send only totalEscrowVolume (job payments).
  const moneyIn = data.moneyIn ?? { total: data.totalEscrowVolume, jobs: data.totalEscrowVolume, parts: 0, trips: 0 };
  const quoteRate = data.totalQuotations === 0 ? 0 : Math.round((data.acceptedQuotations / data.totalQuotations) * 100);
  const days = stats.data?.days ?? [];
  const logs = activity.data?.items ?? [];

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        <TopBar router={router} user={user} unreadCount={unreadCount} initial="W" />

        <View style={styles.body}>
          <Text style={styles.title} accessibilityRole="header">
            Overview
          </Text>
          <Text style={styles.meta}>
            {stats.data ? `${stats.data.totals.users} users, ${stats.data.totals.providers} providers, ` : ''}
            {data.verifiedProviders} verified
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Money in</Text>
            <Text style={styles.money}>{money(moneyIn.total)}</Text>
            <View style={styles.split}>
              {[
                ['Garage jobs', moneyIn.jobs],
                ['Parts orders', moneyIn.parts],
                ['Driver trips', moneyIn.trips],
              ].map(([label, value]) => (
                <View key={label as string} style={styles.splitItem}>
                  <Text style={styles.splitValue}>{money(Number(value))}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>Paid through Weyro, after refunds.</Text>
          </View>

          <View style={styles.stats}>
            <Stat label="Requests" value={String(data.totalRequests)} />
            <Stat label="Open for quotes" value={String(data.openBroadcasts)} />
            <Stat label="Quotes accepted" value={`${quoteRate}%`} />
            <Stat label="Jobs done" value={`${data.completedBookings} of ${data.totalBookings}`} />
          </View>

          <SectionHead title="Needs attention" />
          <ActionRow
            icon={<ShieldCheck size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Provider verification"
            detail={data.pendingVerifications === 0 ? 'Nothing waiting' : `${data.pendingVerifications} waiting for review`}
            onPress={() => router.push('/providers')}
          />
          <ActionRow
            icon={<ClipboardList size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Orders and jobs"
            detail="Search by reference number, refunds"
            onPress={() => router.push('/operations')}
          />
          <ActionRow
            icon={<Landmark size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Payments"
            detail="Held, released and refunded"
            onPress={() => router.push('/escrow')}
          />

          <SectionHead title="Platform activity" />
          <View style={[styles.card, styles.cardAfterHead]}>
            {days.length ? <ActivityChart days={days} /> : <Skeleton width="100%" height={180} />}
          </View>

          <SectionHead title="Recent activity" action="View all" onAction={() => router.push('/activity')} />
          {logs.length === 0 ? (
            <Text style={styles.empty}>No activity recorded yet.</Text>
          ) : (
            logs.map((log, i) => (
              <View key={log.id} style={[styles.logRow, i > 0 && styles.divider]}>
                <Activity size={16} color={palette.textMuted} strokeWidth={1.8} />
                <View style={styles.logText}>
                  <Text style={styles.logAction}>{actionLabel(log.action)}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {[log.entityRef, log.actorRole ? log.actorRole.toLowerCase() : 'system'].filter(Boolean).join(', ')}
                  </Text>
                </View>
                <Text style={styles.statLabel}>{whenShort(log.createdAt)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: spacing.xxl },
  body: { paddingHorizontal: spacing.lg },
  loading: { paddingTop: spacing.lg },
  title: { fontFamily: displayFamily, fontSize: 28, lineHeight: 34, color: palette.textPrimary, marginTop: spacing.sm },
  meta: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xs },
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  cardAfterHead: { marginTop: 0 },
  cardLabel: { ...typography.caption, color: palette.textMuted },
  money: { ...typography.title, color: palette.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  splitItem: { flex: 1 },
  splitValue: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  note: { ...typography.caption, color: palette.textMuted, marginTop: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  stat: { width: '50%', minHeight: 64, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  statValue: { ...typography.heading, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
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
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  logText: { flex: 1 },
  logAction: { ...typography.bodyMedium, color: palette.textPrimary },
  empty: { ...typography.caption, color: palette.textMuted, paddingVertical: spacing.md },
});
