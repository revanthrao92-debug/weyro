import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Activity,
  Bell,
  ChevronRight,
  ClipboardList,
  Landmark,
  LifeBuoy,
  LogOut,
  ShieldCheck,
} from 'lucide-react-native';
import {
  AppHeader,
  PressableScale,
  ScreenContainer,
  SectionHead,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  displayFamily,
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';

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

export function AdminProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <AppHeader title="Profile" subtitle="Admin account" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Admin</Text>
        <Text style={styles.name}>Administrator</Text>
        <Text style={styles.meta}>{user?.email ?? '—'}</Text>

        <View style={styles.identity}>
          <Text style={styles.identityLabel}>Access</Text>
          <Text style={styles.identityValue}>
            Platform operations · verification · payments
          </Text>
        </View>

        <SectionHead index="01" title="Operations" />
        <Action
          icon={<ShieldCheck size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Providers"
          detail="Verification and onboarding"
          onPress={() => router.push('/providers')}
        />
        <Action
          icon={<ClipboardList size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Operations"
          detail="Orders, jobs and disputes"
          onPress={() => router.push('/operations')}
        />
        <Action
          icon={<Landmark size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Payments"
          detail="Held, released and refunded payments"
          onPress={() => router.push('/escrow')}
        />
        <Action
          icon={<Activity size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Activity"
          detail="Audit trail"
          onPress={() => router.push('/activity')}
        />
        <Action
          icon={<Bell size={17} color={palette.textSecondary} strokeWidth={1.8} />}
          label="Alerts"
          onPress={() => router.push('/alerts')}
        />

        <SectionHead index="02" title="Account" />
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
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  identity: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    backgroundColor: palette.surfaceAlt,
    borderLeftWidth: 2,
    borderLeftColor: palette.borderStrong,
    gap: 2,
  },
  identityLabel: { ...typography.label, color: palette.textMuted },
  identityValue: { ...typography.caption, color: palette.textPrimary },
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
});
