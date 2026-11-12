import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  MessageCircle,
  Radar,
  TriangleAlert,
  Wallet,
  Wrench,
} from 'lucide-react-native';
import {
  EmptyState,
  PressableScale,
  ScreenContainer,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useProviderDashboard } from '@/hooks/useProviderDashboard';
import { useBroadcastFeed } from '@/hooks/useRequests';
import { useUpdateProviderProfile } from '@/hooks/useProfile';
import { formatDate, titleize } from '@/utils/format';
import {
  displayFamily,
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';

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

const TYPE_LABEL: Record<string, string> = {
  MECHANIC: 'Mechanic',
  GARAGE: 'Garage',
  AUTHORIZED_CENTER: 'Authorised centre',
};

export function MechanicDashboard() {
  const router = useRouter();
  const { user, providerProfile } = useAuth();
  const query = useProviderDashboard();
  const feedQuery = useBroadcastFeed();
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
    'Workshop';
  const typeLabel = TYPE_LABEL[data.provider.providerType] ?? 'Mechanic';
  const verificationTone =
    data.provider.verificationStatus === 'VERIFIED'
      ? 'success'
      : data.provider.verificationStatus === 'PENDING'
        ? 'warning'
        : 'danger';

  const activeJobs = data.jobs.recent.filter((job) =>
    ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(job.status),
  );
  const feed = (feedQuery.data?.items ?? []).slice(0, 3);

  const attention = [
    {
      key: 'jobs',
      show: data.jobs.active > 0,
      label: `${data.jobs.active} active job${data.jobs.active === 1 ? '' : 's'}`,
      onPress: () => router.push('/jobs'),
    },
    {
      key: 'today',
      show: data.jobs.today > 0,
      label: `${data.jobs.today} job${data.jobs.today === 1 ? '' : 's'} scheduled today`,
      onPress: () => router.push('/jobs'),
    },
    {
      key: 'requests',
      show: data.counts.openRequests > 0,
      label: `${data.counts.openRequests} open request${data.counts.openRequests === 1 ? '' : 's'} nearby`,
      onPress: () => router.push('/opportunities'),
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
      setToggleError('Verification must be approved before accepting jobs.');
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
          <View style={styles.nameBlock}>
            <Text style={styles.eyebrow}>{typeLabel}</Text>
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
              : 'New workshop'}
          </Text>
        </View>

        <PressableScale
          onPress={() => void toggleAvailability()}
          disabled={updateProfile.isPending}
          accessibilityRole="switch"
          accessibilityState={{ checked: data.provider.isAvailable }}
          accessibilityLabel="Accepting jobs"
          style={[styles.availability, data.provider.isAvailable && styles.availabilityOn]}
          scaleTo={0.99}
        >
          <View style={styles.availabilityText}>
            <Text style={styles.availabilityTitle}>
              {data.provider.isAvailable ? 'Accepting jobs' : 'Workshop closed'}
            </Text>
            <Text style={styles.availabilityDetail}>
              {data.provider.isAvailable
                ? 'Customers can send you new repair work.'
                : 'You stay visible but no new jobs are assigned.'}
            </Text>
          </View>
          {updateProfile.isPending ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <View style={[styles.toggle, data.provider.isAvailable && styles.toggleOn]}>
              <Text
                style={[
                  styles.toggleText,
                  data.provider.isAvailable && styles.toggleTextOn,
                ]}
              >
                {data.provider.isAvailable ? 'On' : 'Off'}
              </Text>
            </View>
          )}
        </PressableScale>
        {!verified ? (
          <Text style={styles.notice}>
            Your account is {data.provider.verificationStatus.toLowerCase()}. You
            cannot accept jobs until approval.
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
            label="Active jobs"
            value={data.jobs.active}
            onPress={() => router.push('/jobs')}
          />
          <StatBlock
            label="Completed"
            value={data.jobs.completed}
            onPress={() => router.push('/jobs')}
          />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Needs attention</Text>
        </View>
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

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Assigned jobs</Text>
          {activeJobs.length > 0 ? (
            <PressableScale
              onPress={() => router.push('/jobs')}
              accessibilityRole="link"
              accessibilityLabel="View all jobs"
              scaleTo={0.95}
            >
              <Text style={styles.sectionAction}>View all</Text>
            </PressableScale>
          ) : null}
        </View>
        {activeJobs.length === 0 ? (
          <Text style={styles.emptyLine}>No active jobs. Accepted quotes appear here.</Text>
        ) : (
          activeJobs.slice(0, 3).map((job, index) => {
            const vehicle = job.request?.vehicle
              ? `${job.request.vehicle.make} ${job.request.vehicle.model}`
              : 'Vehicle';
            return (
              <PressableScale
                key={job.id}
                onPress={() => router.push(`/job/${job.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Job ${job.request?.title ?? ''}`}
                style={[styles.dataRow, index > 0 && styles.divider]}
                scaleTo={0.99}
              >
                <View style={styles.dataText}>
                  <Text style={styles.dataTitle} numberOfLines={1}>
                    {job.request?.title ?? 'Service job'}
                  </Text>
                  <Text style={styles.dataMeta} numberOfLines={1}>
                    {job.customer?.firstName ?? 'Customer'} · {vehicle}
                  </Text>
                </View>
                <View style={styles.dataRight}>
                  <Text style={styles.dataAmount}>
                    ₹{Number(job.totalCost).toLocaleString('en-IN')}
                  </Text>
                  <StatusPill
                    label={job.status === 'PROVIDER_EN_ROUTE' ? 'On the way' : titleize(job.status)}
                    tone="info"
                  />
                </View>
              </PressableScale>
            );
          })
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Latest requests</Text>
          <PressableScale
            onPress={() => router.push('/opportunities')}
            accessibilityRole="link"
            accessibilityLabel="View all requests"
            scaleTo={0.95}
          >
            <Text style={styles.sectionAction}>View all</Text>
          </PressableScale>
        </View>
        {feed.length === 0 ? (
          <Text style={styles.emptyLine}>No open requests nearby.</Text>
        ) : (
          feed.map((request, index) => (
            <PressableScale
              key={request.id}
              onPress={() => router.push(`/requests/${request.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Request ${request.title}`}
              style={[styles.dataRow, index > 0 && styles.divider]}
              scaleTo={0.99}
            >
              <View style={styles.dataText}>
                <Text style={styles.dataTitle} numberOfLines={1}>
                  {request.title}
                </Text>
                <Text style={styles.dataMeta} numberOfLines={1}>
                  {titleize(request.category)} · {request.address}
                </Text>
              </View>
              <View style={styles.dataRight}>
                <Text style={styles.dataMeta}>{formatDate(request.createdAt)}</Text>
                <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
              </View>
            </PressableScale>
          ))
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Manage</Text>
        </View>
        <ActionRow
          icon={<Radar size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Requests"
          detail="Repair and maintenance work nearby"
          onPress={() => router.push('/opportunities')}
        />
        <ActionRow
          icon={<CalendarDays size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Jobs"
          detail="Assigned work and schedule"
          onPress={() => router.push('/jobs')}
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
        <ActionRow
          icon={<Wrench size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Profile"
          detail="Workshop details and service radius"
          onPress={() => router.push('/profile')}
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
  nameBlock: { flex: 1 },
  eyebrow: { ...typography.label, color: palette.textMuted, letterSpacing: 0.3 },
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
  meta: { ...typography.caption, color: palette.textMuted, lineHeight: 18 },
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
  availabilityOn: { borderLeftColor: palette.accent },
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
  toggleOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  toggleText: { ...typography.label, color: palette.textSecondary },
  toggleTextOn: { color: palette.onAccent },
  notice: { ...typography.caption, color: palette.warning, marginTop: spacing.xs },
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.xs },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  stat: { width: '50%', paddingVertical: spacing.md, gap: 2 },
  statValue: {
    fontFamily: fontFamilyMono,
    fontSize: 20,
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
  sectionAction: { ...typography.label, color: palette.textSecondary },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  attentionText: { ...typography.body, color: palette.textPrimary, flex: 1 },
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
  dataRight: { alignItems: 'flex-end', gap: 2 },
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
  actionIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  actionDetail: { ...typography.label, color: palette.textMuted, marginTop: 1 },
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
