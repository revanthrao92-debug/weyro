import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BarChart3, Bell, ChevronRight, LifeBuoy, LogOut, MessageCircle, Star } from 'lucide-react-native';
import {
  AppearancePicker,
  ErrorState,
  PageHeader,
  PressableScale,
  ScreenContainer,
  SectionHead,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useProviderProfile } from '@/hooks/useProfile';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
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
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.99} style={styles.action}>
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, danger && styles.actionDanger]}>{label}</Text>
        {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
      </View>
      {danger ? null : <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />}
    </PressableScale>
  );
}

const VERIFICATION: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  VERIFIED: { label: 'Verified', tone: 'success' },
  PENDING: { label: 'Awaiting approval', tone: 'warning' },
  REJECTED: { label: 'Not approved', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

/**
 * Dealer account and settings. The shop on/off switch, counts and work links live on the
 * Dashboard and tab bar, so this screen is only who you are, your details and settings.
 */
export function DealerProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const profileQuery = useProviderProfile();
  const profile = profileQuery.data;

  if (profileQuery.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <PageHeader title="Profile" />
        <Skeleton width="100%" height={96} />
        <Skeleton width="100%" height={180} style={{ marginTop: spacing.md }} />
      </ScreenContainer>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <PageHeader title="Profile" />
        <ErrorState title="Profile unavailable" message="Check your connection and try again." onRetry={() => void profileQuery.refetch()} />
      </ScreenContainer>
    );
  }

  const name = profile.businessName || user?.email?.split('@')[0] || 'Dealer';
  const verification = VERIFICATION[profile.verificationStatus] ?? VERIFICATION.PENDING;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <PageHeader title="Profile" />

        <View style={styles.shop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
          </View>
          <View style={styles.shopText}>
            <Text style={styles.shopName}>{name}</Text>
            <View style={styles.shopMeta}>
              <Text style={styles.metaText}>Parts dealer</Text>
              <StatusPill label={verification.label} tone={verification.tone} />
              {profile.avgRating > 0 ? (
                <View style={styles.rating} accessible accessibilityLabel={`Rated ${profile.avgRating.toFixed(1)}`}>
                  <Star size={14} color={palette.textSecondary} fill={palette.textSecondary} strokeWidth={1.5} />
                  <Text style={styles.metaText}>
                    {profile.avgRating.toFixed(1)} ({profile.totalReviews})
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        {profile.verificationStatus !== 'VERIFIED' ? (
          <Text style={styles.notice}>
            {profile.verificationStatus === 'PENDING'
              ? 'Weyro is checking your documents. You can sell once you are approved.'
              : 'Your account is not active for selling. Contact support for help.'}
          </Text>
        ) : null}

        <SectionHead title="Business details" />
        <Row label="Phone" value={profile.phone} />
        <Row label="Address" value={profile.address} />
        <Row label="Service area" value={`${profile.serviceRadiusKm} km around your shop`} />
        <Row label="Email" value={profile.email ?? user?.email ?? 'Not given'} last />
        <Text style={styles.hint}>To change these, contact support.</Text>

        <SectionHead title="Settings" />
        <AppearancePicker />

        <SectionHead title="More" />
        <Action
          icon={<BarChart3 size={20} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Earnings and forecast"
          onPress={() => router.push('/financials')}
        />
        <Action
          icon={<MessageCircle size={20} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Messages"
          onPress={() => router.push('/inbox')}
        />
        <Action icon={<Bell size={20} color={palette.textSecondary} strokeWidth={1.8} />} label="Alerts" onPress={() => router.push('/alerts')} />
        <Action
          icon={<LifeBuoy size={20} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Contact support"
          detail="support@weyro.app"
          onPress={() => void Linking.openURL('mailto:support@weyro.app')}
        />
        <Action icon={<LogOut size={20} color={palette.danger} strokeWidth={1.8} />} label="Sign out" danger onPress={() => void logout()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  shop: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  avatarText: { fontFamily: displayFamily, fontSize: 22, color: palette.textPrimary },
  shopText: { flex: 1 },
  shopName: { ...typography.heading, color: palette.textPrimary },
  shopMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  metaText: { ...typography.caption, color: palette.textSecondary },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notice: { ...typography.caption, color: palette.warning, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  rowLabel: { ...typography.body, color: palette.textMuted },
  rowValue: { ...typography.body, color: palette.textPrimary, flex: 1, textAlign: 'right' },
  hint: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  actionIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  actionDetail: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  actionDanger: { color: palette.danger },
});
