import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Car,
  MapPin,
  CreditCard,
  Clock3,
  Star,
  UserRoundPen,
  LifeBuoy,
  Settings2,
  LogOut,
  ShoppingBag,
  LayoutDashboard,
  Heart,
  Bell,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer, AppHeader, ListItem, StatusPill } from '@/components/ui';
import { palette, spacing, radii, typography, elevation } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const name =
    user?.customerProfile?.firstName
      ? `${user.customerProfile.firstName} ${user.customerProfile.lastName ?? ''}`.trim()
      : user?.email?.split('@')[0] ?? 'Owner';
  const email = user?.email ?? '';

  return (
    <ScreenContainer chrome="light">
      <AppHeader variant="light" title="Profile" />

      <ScrollView contentContainerStyle={styles.body}>
        {/* Account header */}
        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(name?.[0] || 'W').toUpperCase()}</Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.name} maxFontSizeMultiplier={2}>
              {name}
            </Text>
            <Text style={styles.email} maxFontSizeMultiplier={2}>
              {email}
            </Text>
            <View style={{ marginTop: 6 }}>
              <StatusPill label="Customer" tone="info" />
            </View>
          </View>
        </View>

        
        <View style={styles.headRow}>
          <View style={styles.avatarBig}>
            <Text style={styles.avatarLetter}>{(name?.[0] || 'W').toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName} maxFontSizeMultiplier={2}>{name}</Text>
          <Text style={styles.profileEmail} maxFontSizeMultiplier={2}>{email}</Text>
          <View style={styles.roleChip}><Text style={styles.roleChipText}>Customer</Text></View>
        </View>

<Text style={styles.sectionTitle}>Account</Text>
        <ListItem
          bare
          divider
          title="Edit Profile"
          left={<IconRow Icon={UserRoundPen} />}
          onPress={() => router.push('/profile-edit')}
          accessibilityLabel="Edit profile"
        />
        <ListItem
          bare
          divider
          title="My Vehicles"
          left={<IconRow Icon={Car} />}
          onPress={() => router.push('/vehicles')}
          accessibilityLabel="My vehicles"
        />
        <ListItem
          bare
          divider
          title="My Orders"
          left={<IconRow Icon={ShoppingBag} />}
          onPress={() => router.push('/(app)/bookings')}
          accessibilityLabel="My orders"
        />
        <ListItem
          bare
          divider
          title="My Requirements"
          left={<IconRow Icon={LayoutDashboard} />}
          onPress={() => router.push('/requests/my')}
          accessibilityLabel="My requirements"
        />
        <ListItem
          bare
          divider
          title="Wishlist"
          left={<IconRow Icon={Heart} />}
          onPress={() =>
            Alert.alert('Wishlist', 'Coming soon — saved parts are on their way')
          }
          accessibilityLabel="Wishlist"
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
          divider
          title="Notifications"
          left={<IconRow Icon={Bell} />}
          onPress={() => router.push('/(app)/notifications')}
          accessibilityLabel="Notifications"
        />


        <ListItem
          bare
          divider
          title="Payment Methods"
          subtitle="Coming soon"
          left={<IconRow Icon={CreditCard} />}
          accessibilityLabel="Payment methods"
        />

        <Text style={styles.sectionTitle}>Services</Text>
        <ListItem
          bare
          divider
          title="Service History"
          left={<IconRow Icon={Clock3} />}
          onPress={() => router.push('/bookings')}
          accessibilityLabel="Service history"
        />
        <ListItem
          bare
          divider
          title="My Quotes"
          left={<IconRow Icon={Star} />}
          onPress={() => router.push('/my-quotes')}
          accessibilityLabel="My quotes"
        />
        <ListItem
          bare
          divider
          title="Notification Settings"
          left={<IconRow Icon={Settings2} />}
          onPress={() => router.push('/notifications/push-token')}
          accessibilityLabel="Notification settings"
        />
        <ListItem
          bare
          title="Help & Support"
          subtitle="Coming soon"
          left={<IconRow Icon={LifeBuoy} />}
          accessibilityLabel="Help and support"
        />

        <Pressable
          onPress={() => {
            void logout().then(() => router.replace('/(auth)/login'));
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          className="active:opacity-70"
          style={styles.signOutButton}
        >
          <LogOut size={20} color={palette.danger} strokeWidth={2} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function IconRow({ Icon }: { Icon: any }) {
  return (
    <View style={styles.iconPad}>
      <Icon size={20} color={palette.textSecondary} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  headRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarBig: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarLetter: { ...typography.display, color: palette.onAccent },
  profileName: {
    ...typography.title,
    fontFamily: undefined,
    color: palette.textPrimary,
  },
  profileEmail: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  roleChip: {
    backgroundColor: palette.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    marginTop: spacing.sm,
  },
  roleChipText: {
    ...typography.label,
    color: palette.onAccent,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    ...elevation.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.heading,
    color: palette.onAccent,
  },
  name: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  email: {
    ...typography.caption,
    color: palette.textMuted,
  },
  iconPad: { width: 32 },
  sectionTitle: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.dangerSoftBg,
    backgroundColor: palette.dangerSoftBg,
  },
  signOutText: {
    ...typography.bodyMedium,
    color: palette.danger,
  },
});
