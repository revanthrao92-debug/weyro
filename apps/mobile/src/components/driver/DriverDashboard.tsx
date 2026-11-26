import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarClock, ChevronRight, MessageCircle, Wallet } from 'lucide-react-native';
import {
  ErrorState,
  FadeSlideIn,
  PressableScale,
  ScreenContainer,
  SectionHead,
  Skeleton,
  StatusPill,
  SwitchRow,
} from '@/components/ui';
import { TopBar } from '@/components/home/customer/TopBar';
import { EarningsChart } from '@/components/dealer/EarningsChart';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useProviderAnalytics } from '@/hooks/useProviderAnalytics';
import { useDriverJobs, useDriverMe, useSetDriverOnline } from '@/hooks/useDriverGo';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';
import { compactRupees } from '@/utils/earningsChart';
import { titleize } from '@/utils/format';
import { money } from './driverFormat';
import { TripRequestCard, TripToDoCard } from './TripCards';

const stagger = (i: number) => 60 + i * 70;

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

/** Driver Go home: online switch, earnings, and the next thing to do. */
export function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const meQuery = useDriverMe();
  const jobsQuery = useDriverJobs();
  const analytics = useProviderAnalytics(30);
  const { unreadCount } = useNotifications();
  const setOnline = useSetDriverOnline();
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const refetchMe = meQuery.refetch;
  const refetchJobs = jobsQuery.refetch;

  useFocusEffect(
    useCallback(() => {
      void refetchMe();
      void refetchJobs();
    }, [refetchMe, refetchJobs]),
  );

  if (meQuery.isLoading) {
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

  if (meQuery.isError || !meQuery.data) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <ErrorState title="Driver profile unavailable" message="Check your connection and try again." onRetry={() => void meQuery.refetch()} />
      </ScreenContainer>
    );
  }

  const me = meQuery.data;
  const verified = me.verificationStatus === 'VERIFIED';
  const jobs = jobsQuery.data?.items ?? [];
  const request = jobs.find((job) => job.status === 'REQUESTED');
  const upcoming = jobs.find((job) => ['CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(job.status));
  const sales = analytics.data;
  const forecast = sales?.forecast.available ? sales.forecast : null;
  const verificationTone = verified ? 'success' : me.verificationStatus === 'PENDING' ? 'warning' : 'danger';

  const toggleOnline = async () => {
    if (!verified) {
      setOnlineError('Verification must be approved before going online.');
      return;
    }
    setOnlineError(null);
    try {
      await setOnline.mutateAsync(!me.isOnline);
    } catch (error: any) {
      setOnlineError(error?.message || 'Could not update your status.');
    }
  };

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <TopBar router={router} user={user} unreadCount={unreadCount} initial={me.businessName[0]} />

        <View style={styles.body}>
          <FadeSlideIn delay={stagger(0)}>
            <Text style={styles.name} numberOfLines={2} accessibilityRole="header">
              {me.businessName}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>Driver</Text>
              <StatusPill label={titleize(me.verificationStatus)} tone={verificationTone} />
              <Text style={styles.meta}>
                {me.completedJobs} trip{me.completedJobs === 1 ? '' : 's'}
                {me.avgRating > 0 ? `, ${me.avgRating.toFixed(1)} rating` : ', new driver'}
              </Text>
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={stagger(1)}>
            <View style={styles.card}>
              <SwitchRow
                title={me.isOnline ? 'You are online' : 'You are offline'}
                detail={me.isOnline ? 'Customers can send you trip requests.' : 'Go online to receive new trips.'}
                value={me.isOnline}
                onToggle={() => void toggleOnline()}
                busy={setOnline.isPending}
                accessibilityLabel="Online for trips"
              />
              {onlineError ? <Text style={styles.error}>{onlineError}</Text> : null}
            </View>
          </FadeSlideIn>

          {request || upcoming ? (
            <FadeSlideIn delay={stagger(2)}>
              <SectionHead title={request ? 'New request' : 'Next trip'} action="All trips" onAction={() => router.push('/driver-jobs')} />
              {request ? (
                <TripRequestCard job={request} onOpen={() => router.push(`/driver-booking/${request.id}`)} />
              ) : upcoming ? (
                <TripToDoCard job={upcoming} onOpen={() => router.push(`/driver-booking/${upcoming.id}`)} />
              ) : null}
            </FadeSlideIn>
          ) : null}

          <FadeSlideIn delay={stagger(3)}>
            <SectionHead title="Earnings" action="Details" onAction={() => router.push('/driver-earnings')} />
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
                    meta: `${sales.summary.paidOrders} trip${sales.summary.paidOrders === 1 ? '' : 's'}. Drag along the line to see each day.`,
                  }}
                  accessibilityLabel={`Earnings chart. Last 30 days ${money(sales.summary.netSales)} from ${sales.summary.paidOrders} trips.`}
                />
              ) : (
                <Text style={styles.emptyLine}>Your earnings show here after your first trip.</Text>
              )}
              {forecast ? (
                <Text style={styles.forecastText}>
                  Next {forecast.horizonDays} days: about <Text style={styles.forecastStrong}>{compactRupees(forecast.projectedTotal)}</Text>, likely{' '}
                  {compactRupees(forecast.projectedLow)} to {compactRupees(forecast.projectedHigh)}
                </Text>
              ) : null}
            </View>
          </FadeSlideIn>

          <View style={styles.stats}>
            <Stat label="Earned today" value={money(me.stats.earningsToday)} />
            <Stat label="Upcoming trips" value={String(me.stats.upcoming)} />
            <Stat label="Trips done" value={String(me.completedJobs)} />
            <Stat label="Rating" value={me.avgRating > 0 ? `${me.avgRating.toFixed(1)} (${me.totalReviews})` : 'Not yet'} />
          </View>

          <SectionHead title="More" />
          <ActionRow
            icon={<CalendarClock size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Availability"
            detail="The days and hours you can drive"
            onPress={() => router.push('/driver-availability')}
          />
          <ActionRow
            icon={<Wallet size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Earnings"
            detail="Trips, platform fee and payouts"
            onPress={() => router.push('/driver-earnings')}
          />
          <ActionRow
            icon={<MessageCircle size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Messages"
            detail="Customer conversations"
            onPress={() => router.push('/inbox')}
          />
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
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
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.sm },
  forecastText: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  forecastStrong: { ...typography.captionMedium, color: palette.textPrimary },
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
  emptyLine: { ...typography.caption, color: palette.textMuted, paddingVertical: spacing.md },
});
