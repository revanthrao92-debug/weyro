import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, LifeBuoy, LogOut } from 'lucide-react-native';
import { AppearancePicker, PageHeader, PressableScale, ScreenContainer, SectionHead, StatusPill } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';

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

/** Admin account and settings. The work itself lives in the tabs (Providers, Operations, Payments, Activity). */
export function AdminProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const email = user?.email ?? 'Not given';

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <PageHeader title="Profile" />

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>W</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.name}>Weyro team</Text>
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
            <View style={styles.pills}>
              <StatusPill label="Admin" tone="neutral" />
            </View>
          </View>
        </View>
        <Text style={styles.hint}>
          You can approve providers, refund payments and see all platform activity. Keep this account to yourself.
        </Text>

        <SectionHead title="Settings" />
        <AppearancePicker />

        <SectionHead title="More" />
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
  email: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  pills: { flexDirection: 'row', marginTop: spacing.xs },
  hint: { ...typography.caption, color: palette.textMuted, marginTop: spacing.sm },
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
