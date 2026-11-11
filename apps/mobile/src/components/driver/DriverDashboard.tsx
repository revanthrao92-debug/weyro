import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  CalendarClock,
  ChevronRight,
  MessageCircle,
  Wallet,
} from 'lucide-react-native';
import {
  AppHeader,
  EmptyState,
  PressableScale,
  ScreenContainer,
  SectionHead,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import {
  useDriverJobs,
  useDriverMe,
  useSetDriverOnline,
} from '@/hooks/useDriverGo';
import { DriverJobCard } from './DriverJobCard';
import { money } from './driverFormat';
import {
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';
import { useCallback, useState } from 'react';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ManageRow({
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
      style={styles.manageRow}
    >
      <View style={styles.manageIcon}>{icon}</View>
      <View style={styles.manageText}>
        <Text style={styles.manageLabel}>{label}</Text>
        <Text style={styles.manageDetail}>{detail}</Text>
      </View>
      <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

export function DriverDashboard() {
  const router = useRouter();
  const meQuery = useDriverMe();
  const jobsQuery = useDriverJobs();
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
        <AppHeader title="Driver Go" subtitle="Loading your day" />
        <View style={styles.body}>
          <Skeleton width="55%" height={28} />
          <Skeleton width="100%" height={88} style={{ marginTop: spacing.lg }} />
          <Skeleton width="100%" height={120} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader title="Driver Go" subtitle="Driver account" />
        <EmptyState
          title="Driver profile unavailable"
          message="Check your connection and try again."
          action={
            <PressableScale
              onPress={() => void meQuery.refetch()}
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

  const me = meQuery.data;
  const jobs = jobsQuery.data?.items ?? [];
  const nextJob =
    jobs.find((job) =>
      ['CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(
        job.status,
      ),
    ) ?? jobs.find((job) => job.status === 'REQUESTED');
  const firstName = me.businessName.split(' ')[0] || 'Driver';
  const verified = me.verificationStatus === 'VERIFIED';
  const verificationTone =
    me.verificationStatus === 'VERIFIED'
      ? 'success'
      : me.verificationStatus === 'PENDING'
        ? 'warning'
        : 'danger';

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
    <ScreenContainer chrome="dark" safeBottom>
      <AppHeader title="Driver Go" subtitle={me.businessName} />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>DRIVER</Text>
          <Text style={styles.title}>
            {greeting()}, {firstName}
          </Text>
          <View style={styles.heroMeta}>
            <StatusPill
              label={me.verificationStatus}
              tone={verificationTone}
            />
            <Text style={styles.heroMetaText}>
              {me.completedJobs} trips ·{' '}
              {me.avgRating > 0 ? `${me.avgRating.toFixed(1)} rating` : 'New driver'}
            </Text>
          </View>
        </View>

        <PressableScale
          onPress={() => void toggleOnline()}
          disabled={setOnline.isPending}
          accessibilityRole="switch"
          accessibilityState={{ checked: me.isOnline }}
          accessibilityLabel="Driver online status"
          scaleTo={0.99}
          style={[styles.onlineCard, me.isOnline && styles.onlineCardActive]}
        >
          <View style={styles.onlineText}>
            <Text style={styles.onlineTitle}>
              {me.isOnline ? "You're online" : "You're offline"}
            </Text>
            <Text style={styles.onlineDetail}>
              {me.isOnline
                ? 'Customers can send you Driver Go jobs.'
                : 'Go online to receive new jobs.'}
            </Text>
          </View>
          {setOnline.isPending ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <View style={[styles.toggle, me.isOnline && styles.toggleActive]}>
              <Text
                style={[
                  styles.toggleText,
                  me.isOnline && styles.toggleTextActive,
                ]}
              >
                {me.isOnline ? 'On' : 'Off'}
              </Text>
            </View>
          )}
        </PressableScale>
        {!verified ? (
          <Text style={styles.notice}>
            Your documents are {me.verificationStatus.toLowerCase()}. You cannot
            receive jobs until approval.
          </Text>
        ) : null}
        {onlineError ? <Text style={styles.error}>{onlineError}</Text> : null}

        <View style={styles.stats}>
          <Stat label="Earned today" value={money(me.stats.earningsToday)} />
          <Stat label="Upcoming" value={String(me.stats.upcoming)} />
          <Stat
            label="Rating"
            value={me.avgRating > 0 ? me.avgRating.toFixed(1) : '—'}
          />
        </View>

        <SectionHead
          index="01"
          title="Next job"
          action="All jobs"
          onAction={() => router.push('/driver-jobs')}
        />
        {jobsQuery.isLoading ? (
          <Skeleton width="100%" height={150} />
        ) : nextJob ? (
          <DriverJobCard
            job={nextJob}
            onPress={() => router.push(`/driver-booking/${nextJob.id}`)}
          />
        ) : (
          <EmptyState
            title="No jobs yet"
            message={
              me.isOnline
                ? 'New Driver Go requests will appear here.'
                : 'Go online to start receiving requests.'
            }
          />
        )}

        <SectionHead index="02" title="Manage" />
        <View style={styles.manage}>
          <ManageRow
            icon={<CalendarClock size={17} color={palette.textPrimary} strokeWidth={1.8} />}
            label="Availability"
            detail="Weekly hours and time off"
            onPress={() => router.push('/driver-availability')}
          />
          <ManageRow
            icon={<Wallet size={17} color={palette.textPrimary} strokeWidth={1.8} />}
            label="Earnings"
            detail="Trips, commission and payouts"
            onPress={() => router.push('/driver-earnings')}
          />
          <ManageRow
            icon={<MessageCircle size={17} color={palette.textPrimary} strokeWidth={1.8} />}
            label="Messages"
            detail="Customer conversations"
            onPress={() => router.push('/messages')}
          />
        </View>

        <Text style={styles.footerMeta}>
          Hyderabad pilot · {me.driver.transmissions.join(' / ').toLowerCase()} ·{' '}
          {me.driver.experienceYears} yrs experience
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
  hero: { gap: 2 },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.display,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroMetaText: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
  },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  onlineCardActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  onlineText: { flex: 1 },
  onlineTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  onlineDetail: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  toggle: {
    minWidth: 54,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  toggleActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  toggleText: { ...typography.label, color: palette.textSecondary },
  toggleTextActive: { color: palette.onAccent },
  notice: {
    ...typography.caption,
    color: palette.warning,
    marginTop: spacing.sm,
  },
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.sm },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  stat: { flex: 1, gap: 2 },
  statValue: {
    fontFamily: fontFamilyMono,
    fontSize: 18,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...typography.label, color: palette.textMuted },
  manage: { gap: 0 },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  manageIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  manageText: { flex: 1 },
  manageLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  manageDetail: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
  footerMeta: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
  },
  retryText: { ...typography.label, color: palette.onAccent },
});
