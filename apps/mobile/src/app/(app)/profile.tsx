import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  CalendarDays,
  Car,
  Clock3,
  LifeBuoy,
  LogOut,
  MapPin,
  Settings2,
  ShoppingBag,
  UserRoundPen,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  ScreenContainer,
  ListItem,
  PressableScale,
  SectionHead,
  StatusPill,
} from '@/components/ui';
import {
  palette,
  spacing,
  radii,
  typography,
  displayFamily,
} from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const name = user?.customerProfile?.firstName
    ? `${user.customerProfile.firstName} ${user.customerProfile.lastName ?? ''}`.trim()
    : user?.email?.split('@')[0] ?? 'Owner';
  const email = user?.email ?? '';

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.accountRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(name?.[0] || 'W').toUpperCase()}</Text>
          </View>
          <View style={styles.accountText}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
          </View>
          <StatusPill label="Customer" tone="neutral" />
        </View>

        <View style={styles.tiles}>
          <PressableScale
            onPress={() => router.push('/bookings')}
            accessibilityRole="button"
            accessibilityLabel="Bookings"
            scaleTo={0.97}
            style={styles.tile}
          >
            <CalendarDays size={19} color={palette.textSecondary} strokeWidth={1.7} />
            <Text style={styles.tileLabel}>Bookings</Text>
          </PressableScale>
          <PressableScale
            onPress={() => router.push('/orders')}
            accessibilityRole="button"
            accessibilityLabel="Orders"
            scaleTo={0.97}
            style={styles.tile}
          >
            <ShoppingBag size={19} color={palette.textSecondary} strokeWidth={1.7} />
            <Text style={styles.tileLabel}>Orders</Text>
          </PressableScale>
          <PressableScale
            onPress={() => router.push('/vehicles')}
            accessibilityRole="button"
            accessibilityLabel="Garage"
            scaleTo={0.97}
            style={styles.tile}
          >
            <Car size={19} color={palette.textSecondary} strokeWidth={1.7} />
            <Text style={styles.tileLabel}>Garage</Text>
          </PressableScale>
        </View>

        <SectionHead title="Account" />
        <View style={styles.list}>
          <ListItem
            bare
            divider
            title="Edit profile"
            left={<IconRow Icon={UserRoundPen} />}
            onPress={() => router.push('/profile-edit')}
            accessibilityLabel="Edit profile"
          />
          <ListItem
            bare
            divider
            title="Addresses"
            left={<IconRow Icon={MapPin} />}
            onPress={() => router.push('/addresses')}
            accessibilityLabel="Addresses"
          />
          <ListItem
            bare
            title="Notifications"
            left={<IconRow Icon={Bell} />}
            onPress={() => router.push('/notifications')}
            accessibilityLabel="Notifications"
          />
        </View>

        <SectionHead title="Activity" />
        <View style={styles.list}>
          <ListItem
            bare
            divider
            title="Bookings"
            subtitle="Service progress and history"
            left={<IconRow Icon={Clock3} />}
            onPress={() => router.push('/bookings')}
            accessibilityLabel="Bookings"
          />
          <ListItem
            bare
            divider
            title="Part orders"
            left={<IconRow Icon={ShoppingBag} />}
            onPress={() => router.push('/orders')}
            accessibilityLabel="Part orders"
          />
          <ListItem
            bare
            title="My requests"
            left={<IconRow Icon={Clock3} />}
            onPress={() => router.push('/requests/my')}
            accessibilityLabel="My requests"
          />
        </View>

        <SectionHead title="Settings" />
        <View style={styles.list}>
          <ListItem
            bare
            divider
            title="Notification settings"
            left={<IconRow Icon={Settings2} />}
            onPress={() => router.push('/notifications/push-token')}
            accessibilityLabel="Notification settings"
          />
          <ListItem
            bare
            title="Help & support"
            left={<IconRow Icon={LifeBuoy} />}
            onPress={() => router.push('/help')}
            accessibilityLabel="Help and support"
          />
        </View>

        <Pressable
          onPress={() => {
            void logout();
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={styles.signOut}
        >
          <LogOut size={18} color={palette.danger} strokeWidth={1.8} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function IconRow({ Icon }: { Icon: any }) {
  return (
    <View style={styles.iconPad}>
      <Icon size={18} color={palette.textSecondary} strokeWidth={1.7} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 104 },
  eyebrow: { ...typography.label, color: palette.textMuted },
  title: {
    fontFamily: displayFamily,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: palette.textPrimary },
  accountText: { flex: 1 },
  name: { ...typography.bodyMedium, color: palette.textPrimary },
  email: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  tileLabel: { ...typography.label, color: palette.textSecondary },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  iconPad: { width: 28 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.dangerSoftBg,
    backgroundColor: palette.dangerSoftBg,
  },
  signOutText: { ...typography.captionMedium, color: palette.danger },
});
