import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BarChart3, ChevronRight, MessageCircle, Radar, Wallet, Wrench } from 'lucide-react-native';
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
import { useProviderDashboard } from '@/hooks/useProviderDashboard';
import { useBroadcastFeed } from '@/hooks/useRequests';
import { useProviderProfile, useUpdateProviderProfile } from '@/hooks/useProfile';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';
import { compactRupees } from '@/utils/earningsChart';
import { formatRupees as money, titleize } from '@/utils/format';
import { nextJobStep } from '@/utils/jobSteps';

const TYPE_LABEL: Record<string, string> = {
  MECHANIC: 'Mechanic',
  GARAGE: 'Garage',
  AUTHORIZED_CENTER: 'Authorised centre',
  TOWING: 'Towing',
  ROADSIDE: 'Roadside assistance',
};

const TOWING_TYPE_LABEL: Record<string, string> = {
  FLATBED: 'Flatbed',
  HOOK_AND_CHAIN: 'Hook and chain',
  MOTORCYCLE: 'Motorcycle',
  ANY: 'Any vehicle',
};

const stagger = (i: number) => 60 + i * 70;

function StatBlock({ label, value, onPress }: { label: string; value: string | number; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} scaleTo={0.98} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </PressableScale>
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

/** Dashboard for garages, mechanics, authorised centres, tow trucks and roadside providers. */
export function MechanicDashboard() {
  const router = useRouter();
  const { user, providerProfile } = useAuth();
  const query = useProviderDashboard();
  const profileQuery = useProviderProfile();
  const feedQuery = useBroadcastFeed();
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
        <ErrorState title="Dashboard unavailable" message="Check your connection and try again." onRetry={() => void query.refetch()} />
      </ScreenContainer>
    );
  }

  const data = query.data;
  const verified = data.provider.verificationStatus === 'VERIFIED';
  const name = data.provider.businessName || providerProfile?.businessName || user?.email?.split('@')[0] || 'Workshop';
  const typeLabel = TYPE_LABEL[data.provider.providerType] ?? 'Mechanic';
  const isTowing = data.provider.providerType === 'TOWING';
  const isRoadside = data.provider.providerType === 'ROADSIDE';
  const isAssist = isTowing || isRoadside;
  const kind = isTowing ? 'tows' : isRoadside ? 'calls' : 'jobs';
  const profile = profileQuery.data;
  const equipment = isTowing
    ? [
        (profile?.towingVehicleTypes ?? []).map((t) => TOWING_TYPE_LABEL[t] ?? titleize(t)).join(', ') || 'Towing equipment not set',
        profile?.maxVehicleWeightKg ? `Up to ${Number(profile.maxVehicleWeightKg).toLocaleString('en-IN')} kg` : 'Weight limit not set',
      ].join('. ')
    : isRoadside
      ? 'Battery, tyre and fuel help on site'
      : null;
  const verificationTone = verified ? 'success' : data.provider.verificationStatus === 'PENDING' ? 'warning' : 'danger';
  const nextUp = data.jobs.recent.filter((job) => ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(job.status)).slice(0, 3);
  const feed = (feedQuery.data?.items ?? []).slice(0, 3);
  const sales = analytics.data;
  const forecast = sales?.forecast.available ? sales.forecast : null;

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
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <TopBar router={router} user={user} unreadCount={unreadCount} initial={name[0]} />

        <View style={styles.body}>
          <FadeSlideIn delay={stagger(0)}>
            <Text style={styles.name} numberOfLines={2} accessibilityRole="header">
              {name}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{typeLabel}</Text>
              <StatusPill label={titleize(data.provider.verificationStatus)} tone={verificationTone} />
              <Text style={styles.meta}>
                {data.provider.avgRating > 0
                  ? `${data.provider.avgRating.toFixed(1)} rating, ${data.provider.totalReviews} reviews`
                  : 'New on Weyro'}
              </Text>
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={stagger(1)}>
            <View style={styles.card}>
              <SwitchRow
                title={data.provider.isAvailable ? 'Accepting jobs' : isAssist ? 'Off duty' : 'Workshop closed'}
                detail={
                  data.provider.isAvailable
                    ? isTowing
                      ? 'Towing calls near you reach you.'
                      : isRoadside
                        ? 'Roadside calls near you reach you.'
                        : 'Customers near you can send you repair work.'
                    : 'You stay visible, but no new work reaches you.'
                }
                value={data.provider.isAvailable}
                onToggle={() => void toggleAvailability()}
                busy={updateProfile.isPending}
                accessibilityLabel="Accepting jobs"
              />
              {!verified ? (
                <Text style={styles.notice}>
                  Your account is {data.provider.verificationStatus.toLowerCase()}. You cannot accept jobs until approval.
                </Text>
              ) : null}
              {toggleError ? <Text style={styles.error}>{toggleError}</Text> : null}
              {equipment ? <Text style={styles.cardDetail}>{equipment}</Text> : null}
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
                    meta: `${sales.summary.paidOrders} paid ${kind}. Drag along the line to see each day.`,
                  }}
                  accessibilityLabel={`Earnings chart. Last 30 days ${money(sales.summary.netSales)} from ${sales.summary.paidOrders} ${kind}.${
                    forecast ? ` Next ${forecast.horizonDays} days, about ${money(forecast.projectedTotal)}.` : ''
                  }`}
                />
              ) : (
                <Text style={styles.emptyLine}>Your earnings show here after your first finished job.</Text>
              )}
              {forecast ? (
                <PressableScale
                  onPress={() => router.push('/financials')}
                  accessibilityRole="button"
                  accessibilityLabel={`Forecast: next ${forecast.horizonDays} days about ${money(forecast.projectedTotal)}, likely ${money(
                    forecast.projectedLow,
                  )} to ${money(forecast.projectedHigh)}`}
                  scaleTo={0.99}
                  style={styles.forecastRow}
                >
                  <View style={styles.legendDash} />
                  <Text style={styles.forecastText}>
                    Next {forecast.horizonDays} days: about <Text style={styles.forecastStrong}>{compactRupees(forecast.projectedTotal)}</Text>,
                    likely {compactRupees(forecast.projectedLow)} to {compactRupees(forecast.projectedHigh)}
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
              <StatBlock label="In progress" value={data.jobs.active} onPress={() => router.push('/jobs')} />
              <StatBlock label="Booked today" value={data.jobs.today} onPress={() => router.push('/jobs')} />
              <StatBlock label="Requests near you" value={data.counts.openRequests} onPress={() => router.push('/opportunities')} />
              <StatBlock label="Quotes waiting" value={data.counts.pendingQuotes} onPress={() => router.push('/my-quotes')} />
            </View>
          </FadeSlideIn>

          <SectionHead title="Next up" action={nextUp.length > 0 ? 'All jobs' : undefined} onAction={() => router.push('/jobs')} />
          {nextUp.length === 0 ? (
            <Text style={styles.emptyLine}>Nothing in progress. Accepted quotes show up here.</Text>
          ) : (
            nextUp.map((job, index) => {
              const step = nextJobStep({ status: job.status, quotation: { request: { category: job.request?.category } } });
              const car = job.request?.vehicle ? `${job.request.vehicle.make} ${job.request.vehicle.model}` : null;
              return (
                <PressableScale
                  key={job.id}
                  onPress={() => router.push(`/job/${job.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Job ${job.request?.title ?? ''}, ${step?.label ?? ''}`}
                  style={[styles.row, index > 0 && styles.divider]}
                  scaleTo={0.99}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {job.request?.title ?? 'Service job'}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[job.customer?.firstName ?? 'Customer', car].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.amount}>{money(job.totalCost)}</Text>
                    {step ? <StatusPill label={step.label} tone="info" /> : null}
                  </View>
                </PressableScale>
              );
            })
          )}

          <SectionHead title={isAssist ? 'Calls near you' : 'Requests near you'} action="View all" onAction={() => router.push('/opportunities')} />
          {feed.length === 0 ? (
            <Text style={styles.emptyLine}>Nothing near you right now. You get a notification when a new one comes in.</Text>
          ) : (
            feed.map((request: any, index: number) => (
              <PressableScale
                key={request.id}
                onPress={() => router.push(`/requests/${request.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Request ${request.title}`}
                style={[styles.row, index > 0 && styles.divider]}
                scaleTo={0.99}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {request.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {[
                      Number(request.distanceKm) > 0 ? `${Number(request.distanceKm).toFixed(1)} km away` : null,
                      Number(request.quotationsCount ?? 0) === 0 ? 'Be the first to quote' : `${request.quotationsCount} quotes so far`,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
                <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
              </PressableScale>
            ))
          )}

          <SectionHead title="More" />
          <ActionRow
            icon={<BarChart3 size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Earnings and forecast"
            detail={`Money from finished ${kind} and the next 14 days`}
            onPress={() => router.push('/financials')}
          />
          <ActionRow
            icon={<Wallet size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="My quotes"
            detail="Quotes you sent and their status"
            onPress={() => router.push('/my-quotes')}
          />
          <ActionRow
            icon={<Radar size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Requests"
            detail={isAssist ? 'Calls near you' : 'Repair work near you'}
            onPress={() => router.push('/opportunities')}
          />
          <ActionRow
            icon={<Wrench size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Jobs"
            detail={`Your ${kind} in progress and finished`}
            onPress={() => router.push('/jobs')}
          />
          <ActionRow
            icon={<MessageCircle size={20} color={palette.textSecondary} strokeWidth={1.8} />}
            label="Messages"
            detail="Customer conversations"
            onPress={() => router.push('/inbox')}
          />

          <Text style={styles.footer}>
            {data.jobs.completed} {kind} finished, {data.provider.serviceRadiusKm} km service area
          </Text>
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
  cardDetail: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  stat: { width: '50%', minHeight: 64, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  statValue: { ...typography.heading, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  rowMeta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
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
