import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarClock,
  ChevronRight,
  LifeBuoy,
  LogOut,
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
import { useAuth } from '@/hooks/useAuth';
import { useDriverMe } from '@/hooks/useDriverGo';
import { money } from './driverFormat';
import {
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
  onPress,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
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
      <Text style={[styles.actionLabel, danger && styles.actionDanger]}>
        {label}
      </Text>
      <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

export function DriverProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const query = useDriverMe();
  const me = query.data;
  const name = me?.businessName || user?.email?.split('@')[0] || 'Driver';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <AppHeader title="Profile" subtitle="Driver account" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {query.isLoading ? (
          <>
            <Skeleton width="100%" height={80} />
            <Skeleton width="100%" height={120} style={{ marginTop: spacing.md }} />
          </>
        ) : query.isError || !me ? (
          <EmptyState
            title="Profile unavailable"
            message="Check your connection and try again."
          />
        ) : (
          <>
            <View style={styles.accountRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || 'D'}</Text>
              </View>
              <View style={styles.accountText}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {me.email || me.phone}
                </Text>
              </View>
              <StatusPill
                label={me.verificationStatus}
                tone={me.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}
              />
            </View>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{me.completedJobs}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {me.avgRating > 0 ? me.avgRating.toFixed(1) : '—'}
                </Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {money(me.stats.earningsToday)}
                </Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
            </View>

            <SectionHead index="01" title="Driver details" />
            <Row label="Experience" value={`${me.driver.experienceYears} years`} />
            <Row
              label="Transmissions"
              value={me.driver.transmissions.join(' / ') || 'Not set'}
            />
            <Row
              label="Languages"
              value={me.driver.languages.join(', ') || 'Not set'}
            />
            <Row label="Hourly" value={money(me.driver.hourlyRate)} />
            <Row label="Daily" value={money(me.driver.dailyRate)} />
            <Row
              label="Licence"
              value={
                me.driver.licenceNumber
                  ? `${me.driver.licenceNumber} · expires ${
                      me.driver.licenceExpiry
                        ? new Date(me.driver.licenceExpiry).toLocaleDateString()
                        : '—'
                    }`
                  : 'Pending'
              }
            />

            <SectionHead index="02" title="Account" />
            <Action
              icon={<CalendarClock size={17} color={palette.textPrimary} strokeWidth={1.8} />}
              label="Availability"
              onPress={() => router.push('/driver-availability')}
            />
            <Action
              icon={<Wallet size={17} color={palette.textPrimary} strokeWidth={1.8} />}
              label="Earnings"
              onPress={() => router.push('/driver-earnings')}
            />
            <Action
              icon={<MessageCircle size={17} color={palette.textPrimary} strokeWidth={1.8} />}
              label="Messages"
              onPress={() => router.push('/messages')}
            />
            <Action
              icon={<LifeBuoy size={17} color={palette.textPrimary} strokeWidth={1.8} />}
              label="Contact support"
              onPress={() => void Linking.openURL('mailto:support@weyro.app')}
            />
            <Action
              icon={<LogOut size={17} color={palette.danger} strokeWidth={1.8} />}
              label="Sign out"
              danger
              onPress={() => void logout()}
            />
          </>
        )}
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
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  avatarText: { ...typography.bodyMedium, color: palette.textPrimary },
  accountText: { flex: 1 },
  name: { ...typography.bodyMedium, color: palette.textPrimary },
  email: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
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
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  actionLabel: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    flex: 1,
  },
  actionDanger: { color: palette.danger },
});
