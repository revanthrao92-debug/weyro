import { ReactElement } from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import {
  Activity,
  Bell,
  CalendarDays,
  Gauge,
  House,
  Landmark,
  LayoutDashboard,
  MessageCircle,
  Package,
  Radar,
  ShoppingBag,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { palette, fontFamilyMedium } from '@/theme';

/**
 * Premium line icons for the tab bar (lucide — already a dependency via
 * RNR; cross-platform via react-native-svg). Thin 1.75 strokes for a
 * refined look; color comes from the navigator's active/inactive tints.
 */
const tabIcon = (IconCmp: LucideIcon) => {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <IconCmp color={color as string} size={size} strokeWidth={1.75} />;
  }
  return TabIcon;
};

/**
 * Every route in the (app) group must be declared: a Tabs.Screen with a title
 * shows the tab; with `href: null` it keeps the route but hides it (JS tabs
 * auto-register every file in the group otherwise).
 *
 * Screens are collected into a flat ARRAY on purpose: expo-router only
 * traverses Screen elements and plain arrays — `React.Children` does NOT
 * descend into fragments, so wrapping the branches in <>...</> made the
 * router drop every declaration with a console warning (losing titles and
 * href hiding entirely).
 */
export default function AppLayout() {
  const { role } = useAuth();
  const insets = useSafeAreaInsets();

  const screens: ReactElement[] =
    role === 'ADMIN'
      ? [
          <Tabs.Screen key="index" name="index" options={{ title: 'Overview', tabBarIcon: tabIcon(Gauge) }} />,
          <Tabs.Screen key="providers" name="providers" options={{ title: 'Providers', tabBarIcon: tabIcon(Wrench) }} />,
          <Tabs.Screen key="escrow" name="escrow" options={{ title: 'Escrow Ledger', tabBarIcon: tabIcon(Landmark) }} />,
          <Tabs.Screen key="activity" name="activity" options={{ title: 'Activity', tabBarIcon: tabIcon(Activity) }} />,
          <Tabs.Screen key="notifications" name="notifications" options={{ title: 'Alerts', tabBarIcon: tabIcon(Bell) }} />,
          <Tabs.Screen key="profile" name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(User) }} />,
          <Tabs.Screen key="bookings" name="bookings" options={{ href: null }} />,
          <Tabs.Screen key="messages" name="messages" options={{ href: null }} />,
          <Tabs.Screen key="shop" name="shop" options={{ href: null }} />,
          <Tabs.Screen key="opportunities" name="opportunities" options={{ href: null }} />,
          <Tabs.Screen key="orders" name="orders" options={{ href: null }} />,
        ]
      : role === 'PROVIDER' || role === 'BOTH'
        ? [
            <Tabs.Screen key="index" name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon(LayoutDashboard) }} />,
            <Tabs.Screen key="opportunities" name="opportunities" options={{ title: 'Opportunities', tabBarIcon: tabIcon(Radar) }} />,
            <Tabs.Screen key="orders" name="orders" options={{ title: 'Orders', tabBarIcon: tabIcon(Package) }} />,
            <Tabs.Screen key="messages" name="messages" options={{ title: 'Messages', tabBarIcon: tabIcon(MessageCircle) }} />,
            <Tabs.Screen key="notifications" name="notifications" options={{ title: 'Alerts', tabBarIcon: tabIcon(Bell) }} />,
            <Tabs.Screen key="profile" name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(User) }} />,
            <Tabs.Screen key="providers" name="providers" options={{ href: null }} />,
            <Tabs.Screen key="escrow" name="escrow" options={{ href: null }} />,
            <Tabs.Screen key="activity" name="activity" options={{ href: null }} />,
            <Tabs.Screen key="bookings" name="bookings" options={{ href: null }} />,
            <Tabs.Screen key="shop" name="shop" options={{ href: null }} />,
          ]
        : [
            <Tabs.Screen key="index" name="index" options={{ title: 'Home', tabBarIcon: tabIcon(House) }} />,
            <Tabs.Screen key="bookings" name="bookings" options={{ title: 'Bookings', tabBarIcon: tabIcon(CalendarDays) }} />,
            <Tabs.Screen key="messages" name="messages" options={{ title: 'Messages', tabBarIcon: tabIcon(MessageCircle) }} />,
            <Tabs.Screen key="shop" name="shop" options={{ title: 'Shop', tabBarIcon: tabIcon(ShoppingBag) }} />,
            <Tabs.Screen key="notifications" name="notifications" options={{ href: null }} />,
            <Tabs.Screen key="profile" name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(User) }} />,
            <Tabs.Screen key="providers" name="providers" options={{ href: null }} />,
            <Tabs.Screen key="escrow" name="escrow" options={{ href: null }} />,
            <Tabs.Screen key="activity" name="activity" options={{ href: null }} />,
            <Tabs.Screen key="opportunities" name="opportunities" options={{ href: null }} />,
            <Tabs.Screen key="orders" name="orders" options={{ href: null }} />,
          ];

  // Non-tab screens available to every role (pushed, not shown in the bar).
  screens.push(
    <Tabs.Screen key="sos" name="sos" options={{ href: null }} />,
    <Tabs.Screen key="help" name="help" options={{ href: null }} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.borderStrong,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamilyMedium,
          fontSize: 10,
          lineHeight: 12,
        },
      }}
    >
      {screens}
    </Tabs>
  );
}
