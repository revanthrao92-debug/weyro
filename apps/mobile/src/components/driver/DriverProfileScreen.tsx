import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, CalendarClock, ChevronRight, LifeBuoy, LogOut, MessageCircle, Star, Wallet } from 'lucide-react-native';
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
import { useDriverMe } from '@/hooks/useDriverGo';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';
import { titleize } from '@/utils/format';
import { money } from './driverFormat';

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

const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Driver account: who you are, your driving details, settings. Trips and earnings live on Home. */
export function DriverProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const query = useDriverMe();
  const me = query.data;

  if (query.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <PageHeader title="Profile" />
        <Skeleton width="100%" height={96} />
        <Skeleton width="100%" height={180} style={{ marginTop: spacing.md }} />
      </ScreenContainer>
    );
  }

  if (query.isError || !me) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <PageHeader title="Profile" />
        <ErrorState title="Profile unavailable" message="Check your connection and try again." onRetry={() => void query.refetch()} />
      </ScreenContainer>
    );
  }

  const name = me.businessName || user?.email?.split('@')[0] || 'Driver';
  const verification = VERIFICATION[me.verificationStatus] ?? VERIFICATION.PENDING;
  const d = me.driver;
  const licence = d.licenceNumber
    ? d.licenceExpiry
      ? `${d.licenceNumber}, valid until ${dateText(d.licenceExpiry)}`
      : d.licenceNumber
    : 'Not added yet';

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <PageHeader title="Profile" />

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.name}>{name}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>Driver</Text>
              <StatusPill label={verification.label} tone={verification.tone} />
              {me.avgRating > 0 ? (
                <View style={styles.rating} accessible accessibilityLabel={`Rated ${me.avgRating.toFixed(1)}`}>
                  <Star size={14} color={palette.textSecondary} fill={palette.textSecondary} strokeWidth={1.5} />
                  <Text style={styles.metaText}>
                    {me.avgRating.toFixed(1)} ({me.totalReviews})
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        {me.verificationStatus !== 'VERIFIED' ? (
          <Text style={styles.notice}>
            {me.verificationStatus === 'PENDING'
              ? 'Weyro is checking your documents. You can go online once you are approved.'
              : 'Your account is not active for trips. Contact support for help.'}
          </Text>
        ) : null}

        <SectionHead title="Driving details" />
        <Row label="Experience" value={`${d.experienceYears} year${d.experienceYears === 1 ? '' : 's'}`} />
        <Row label="Cars you drive" value={d.transmissions.map(titleize).join(', ') || 'Not set'} />
        <Row label="Languages" value={d.languages.join(', ') || 'Not set'} />
        <Row label="Hourly rate" value={money(d.hourlyRate)} />
        <Row label="Daily rate" value={money(d.dailyRate)} />
        <Row label="Licence" value={licence} />
        <Row label="Email" value={me.email || user?.email || 'Not given'} />
        <Row label="Phone" value={me.phone || 'Not given'} last />
        <Text style={styles.hint}>To change these, contact support.</Text>

        <SectionHead title="Settings" />
        <AppearancePicker />

        <SectionHead title="More" />
        <Action
          icon={<CalendarClock size={20} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Availability"
          detail="The days and hours you can drive"
          onPress={() => router.push('/driver-availability')}
        />
        <Action
          icon={<Wallet size={20} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Earnings and forecast"
          onPress={() => router.push('/driver-earnings')}
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
  card: {
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
  cardText: { flex: 1 },
  name: { ...typography.heading, color: palette.textPrimary },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
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
