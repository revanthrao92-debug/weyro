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
  ChevronRight,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Package,
  Radar,
  Tag,
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

export function DealerProfileScreen() {
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
        <AppHeader title="Profile" subtitle="Dealer account" />
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
        <AppHeader title="Profile" subtitle="Dealer account" />
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
  const name = profile.businessName || user?.email?.split('@')[0] || 'Dealer';

  const toggleAvailability = async () => {
    if (!verified) {
      setError('Verification must be approved before accepting orders.');
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
      <AppHeader title="Profile" subtitle="Dealer account" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Dealer</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {profile.providerType === 'PARTS_DEALER'
            ? 'Parts dealer'
            : profile.providerType}{' '}
          · {profile.verificationStatus.toLowerCase()}
        </Text>

        <PressableScale
          onPress={() => void toggleAvailability()}
          disabled={updateProfile.isPending}
          accessibilityRole="switch"
          accessibilityState={{ checked: profile.isAvailable }}
          accessibilityLabel="Accepting orders"
          scaleTo={0.99}
          style={[styles.availability, profile.isAvailable && styles.availabilityOn]}
        >
          <View style={styles.availabilityText}>
            <Text style={styles.availabilityTitle}>
              {profile.isAvailable ? 'Accepting orders' : 'Shop closed'}
            </Text>
            <Text style={styles.availabilityDetail}>
              {profile.isAvailable
                ? 'Customers can buy your active listings.'
                : 'Listings remain visible but orders are closed.'}
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
            <Text style={styles.statValue}>{profile.counts?.listings ?? 0}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{dashboard?.counts.pendingOrders ?? 0}</Text>
            <Text style={styles.statLabel}>To fulfill</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {profile.avgRating > 0 ? profile.avgRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <SectionHead title="Business" />
        <Row label="Phone" value={profile.phone} />
        <Row label="Address" value={profile.address} />
        <Row label="Service radius" value={`${profile.serviceRadiusKm} km`} />
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

        <SectionHead title="Manage" />
        <Action
          icon={<Radar size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Requests"
          detail="Open spare-part requests"
          onPress={() => router.push('/opportunities')}
        />
        <Action
          icon={<Package size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Orders"
          detail="Fulfill paid orders"
          onPress={() => router.push('/orders')}
        />
        <Action
          icon={<Tag size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Listings"
          detail="Price, stock and visibility"
          onPress={() => router.push('/my-listings')}
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
  eyebrow: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.3,
  },
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
  actionIcon: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  actionDetail: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
  actionDanger: { color: palette.danger },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: palette.accent,
  },
  retryText: { ...typography.label, color: palette.onAccent },
});
