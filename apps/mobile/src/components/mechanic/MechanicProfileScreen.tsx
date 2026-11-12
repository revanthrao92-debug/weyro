import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
  LifeBuoy,
  LogOut,
  MessageCircle,
  Radar,
  Wallet,
} from 'lucide-react-native';
import {
  AppHeader,
  EmptyState,
  PressableScale,
  ScreenContainer,
  SectionHead,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useProviderProfile, useUpdateProviderProfile } from '@/hooks/useProfile';
import { useProviderDashboard } from '@/hooks/useProviderDashboard';
import {
  displayFamily,
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';

const TYPE_LABEL: Record<string, string> = {
  MECHANIC: 'Mechanic',
  GARAGE: 'Garage',
  AUTHORIZED_CENTER: 'Authorised centre',
  TOWING: 'Towing',
  ROADSIDE: 'Roadside assistance',
};

const TOWING_TYPE_LABEL: Record<string, string> = {
  FLATBED: 'Flatbed',
  HOOK_AND_CHAIN: 'Hook & chain',
  MOTORCYCLE: 'Motorcycle',
  ANY: 'Any vehicle',
};

const CATEGORY_LABEL: Record<string, string> = {
  MECHANIC: 'Repair · Maintenance · Inspection',
  GARAGE: 'Repair · Maintenance · Inspection',
  AUTHORIZED_CENTER: 'Repair · Maintenance · Inspection',
  TOWING: 'Towing · Recovery',
  ROADSIDE: 'Battery · Tyre · Fuel',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  detail,
  onPress,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.99}
      style={styles.action}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, danger && styles.actionDanger]}>
          {label}
        </Text>
        {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
      </View>
      <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

export function MechanicProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const profileQuery = useProviderProfile();
  const dashboardQuery = useProviderDashboard();
  const updateProfile = useUpdateProviderProfile();
  const [error, setError] = useState<string | null>(null);

  const profile = profileQuery.data;
  const dashboard = dashboardQuery.data;

  if (profileQuery.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader title="Profile" subtitle="Account" />
        <View style={styles.body}>
          <Skeleton width="100%" height={80} />
          <Skeleton width="100%" height={140} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader title="Profile" subtitle="Account" />
        <EmptyState
          title="Profile unavailable"
          message="Check your connection and try again."
          action={
            <PressableScale
              onPress={() => void profileQuery.refetch()}
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

  const verified = profile.verificationStatus === 'VERIFIED';
  const name = profile.businessName || user?.email?.split('@')[0] || 'Workshop';
  const isTowing = profile.providerType === 'TOWING';
  const isRoadside = profile.providerType === 'ROADSIDE';
  const accountLabel = isTowing
    ? 'Towing account'
    : isRoadside
      ? 'Roadside account'
      : 'Workshop account';
  const isAssist = isTowing || isRoadside;
  const equipment = isTowing
    ? [
        (profile.towingVehicleTypes ?? [])
          .map((type) => TOWING_TYPE_LABEL[type] ?? type)
          .join(' · ') || 'Not set',
        profile.maxVehicleWeightKg
          ? `Up to ${Number(profile.maxVehicleWeightKg).toLocaleString('en-IN')} kg`
          : 'Weight limit not set',
      ]
    : null;

  const toggleAvailability = async () => {
    if (!verified) {
      setError('Verification must be approved before accepting jobs.');
      return;
    }
    setError(null);
    try {
      await updateProfile.mutateAsync({ isAvailable: !profile.isAvailable });
      await Promise.all([profileQuery.refetch(), dashboardQuery.refetch()]);
    } catch (e: any) {
      setError(e?.message || 'Could not update availability.');
    }
  };

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <AppHeader title="Profile" subtitle={accountLabel} />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          {TYPE_LABEL[profile.providerType] ?? 'Mechanic'}
        </Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {profile.providerType === 'AUTHORIZED_CENTER'
            ? 'Authorised centre'
            : profile.providerType.toLowerCase()}{' '}
          · {profile.verificationStatus.toLowerCase()}
        </Text>

        <PressableScale
          onPress={() => void toggleAvailability()}
          disabled={updateProfile.isPending}
          accessibilityRole="switch"
          accessibilityState={{ checked: profile.isAvailable }}
          accessibilityLabel="Accepting jobs"
          scaleTo={0.99}
          style={[styles.availability, profile.isAvailable && styles.availabilityOn]}
        >
          <View style={styles.availabilityText}>
            <Text style={styles.availabilityTitle}>
              {profile.isAvailable
                ? 'Accepting jobs'
                : isAssist
                  ? 'Off duty'
                  : 'Workshop closed'}
            </Text>
            <Text style={styles.availabilityDetail}>
              {profile.isAvailable
                ? isTowing
                  ? 'Towing calls can reach you.'
                  : isRoadside
                    ? 'Roadside calls can reach you.'
                    : 'Customers can send you new repair work.'
                : 'No new jobs are assigned while closed.'}
            </Text>
          </View>
          {updateProfile.isPending ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <View style={[styles.toggle, profile.isAvailable && styles.toggleOn]}>
              <Text
                style={[
                  styles.toggleText,
                  profile.isAvailable && styles.toggleTextOn,
                ]}
              >
                {profile.isAvailable ? 'On' : 'Off'}
              </Text>
            </View>
          )}
        </PressableScale>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{dashboard?.jobs.active ?? 0}</Text>
            <Text style={styles.statLabel}>Active jobs</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.completedJobs ?? 0}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {profile.avgRating > 0 ? profile.avgRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <SectionHead index="01" title={isTowing || isRoadside ? 'Business' : 'Workshop'} />
        <Row label="Phone" value={profile.phone} />
        <Row label="Address" value={profile.address} />
        <Row label="Service radius" value={`${profile.serviceRadiusKm} km`} />
        <Row
          label="Work"
          value={CATEGORY_LABEL[profile.providerType] ?? 'Repair and maintenance'}
        />
        {equipment ? (
          <>
            <Row label="Equipment" value={equipment[0]} />
            <Row label="Capacity" value={equipment[1]} />
          </>
        ) : null}
        <Row label="Email" value={profile.email ?? user?.email ?? '—'} />
        <Row
          label="Verification"
          value={
            verified
              ? 'Verified'
              : profile.verificationStatus === 'PENDING'
                ? 'Awaiting approval'
                : profile.verificationStatus
          }
        />

        <SectionHead index="02" title="Manage" />
        <Action
          icon={<Radar size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Requests"
          detail={
            isTowing
              ? 'Towing jobs nearby'
              : isRoadside
                ? 'Roadside calls nearby'
                : 'Repair and maintenance work nearby'
          }
          onPress={() => router.push('/opportunities')}
        />
        <Action
          icon={<CalendarDays size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Jobs"
          detail={
            isTowing ? 'Assigned tows and deliveries' : 'Assigned work and schedule'
          }
          onPress={() => router.push('/jobs')}
        />
        <Action
          icon={<Wallet size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Quotes"
          detail="Sent quotes and their status"
          onPress={() => router.push('/my-quotes')}
        />
        <Action
          icon={<MessageCircle size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Messages"
          onPress={() => router.push('/inbox')}
        />
        <Action
          icon={<Bell size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Alerts"
          onPress={() => router.push('/alerts')}
        />
        <Action
          icon={<LifeBuoy size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Contact support"
          onPress={() => void Linking.openURL('mailto:support@weyro.app')}
        />
        <Action
          icon={<LogOut size={17} color={palette.danger} strokeWidth={1.8} />}
          label="Sign out"
          danger
          onPress={() => void logout()}
        />
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
  eyebrow: { ...typography.label, color: palette.textMuted, letterSpacing: 0.3 },
  name: {
    fontFamily: displayFamily,
    fontSize: 30,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  meta: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 2,
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
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.xs },
  stats: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowLabel: { ...typography.label, color: palette.textMuted },
  rowValue: {
    ...typography.body,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  action: {
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
  actionDanger: { color: palette.danger },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  retryText: { ...typography.label, color: palette.textPrimary },
});
