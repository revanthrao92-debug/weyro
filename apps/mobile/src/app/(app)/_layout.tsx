import { ReactElement } from 'react';
import { Tabs } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { palette, fontFamilyMedium } from '@/theme';

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

  const screens: ReactElement[] =
    role === 'ADMIN'
      ? [
          <Tabs.Screen key="index" name="index" options={{ title: 'Overview' }} />,
          <Tabs.Screen key="providers" name="providers" options={{ title: 'Providers' }} />,
          <Tabs.Screen key="escrow" name="escrow" options={{ title: 'Escrow Ledger' }} />,
          <Tabs.Screen key="activity" name="activity" options={{ title: 'Activity' }} />,
          <Tabs.Screen key="notifications" name="notifications" options={{ title: 'Notifications' }} />,
          <Tabs.Screen key="profile" name="profile" options={{ title: 'Profile' }} />,
          <Tabs.Screen key="bookings" name="bookings" options={{ href: null }} />,
          <Tabs.Screen key="messages" name="messages" options={{ href: null }} />,
          <Tabs.Screen key="shop" name="shop" options={{ href: null }} />,
          <Tabs.Screen key="opportunities" name="opportunities" options={{ href: null }} />,
          <Tabs.Screen key="orders" name="orders" options={{ href: null }} />,
        ]
      : role === 'PROVIDER' || role === 'BOTH'
        ? [
            <Tabs.Screen key="index" name="index" options={{ title: 'Dashboard' }} />,
            <Tabs.Screen key="opportunities" name="opportunities" options={{ title: 'Opportunities' }} />,
            <Tabs.Screen key="orders" name="orders" options={{ title: 'Orders' }} />,
            <Tabs.Screen key="messages" name="messages" options={{ title: 'Messages' }} />,
            <Tabs.Screen key="notifications" name="notifications" options={{ title: 'Notifications' }} />,
            <Tabs.Screen key="profile" name="profile" options={{ title: 'Profile' }} />,
            <Tabs.Screen key="providers" name="providers" options={{ href: null }} />,
            <Tabs.Screen key="escrow" name="escrow" options={{ href: null }} />,
            <Tabs.Screen key="activity" name="activity" options={{ href: null }} />,
            <Tabs.Screen key="bookings" name="bookings" options={{ href: null }} />,
            <Tabs.Screen key="shop" name="shop" options={{ href: null }} />,
          ]
        : [
            <Tabs.Screen key="index" name="index" options={{ title: 'Home' }} />,
            <Tabs.Screen key="bookings" name="bookings" options={{ title: 'Bookings' }} />,
            <Tabs.Screen key="messages" name="messages" options={{ title: 'Messages' }} />,
            <Tabs.Screen key="shop" name="shop" options={{ title: 'Shop' }} />,
            <Tabs.Screen key="notifications" name="notifications" options={{ title: 'Notifications' }} />,
            <Tabs.Screen key="profile" name="profile" options={{ title: 'Profile' }} />,
            <Tabs.Screen key="providers" name="providers" options={{ href: null }} />,
            <Tabs.Screen key="escrow" name="escrow" options={{ href: null }} />,
            <Tabs.Screen key="activity" name="activity" options={{ href: null }} />,
            <Tabs.Screen key="opportunities" name="opportunities" options={{ href: null }} />,
            <Tabs.Screen key="orders" name="orders" options={{ href: null }} />,
          ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: { fontFamily: fontFamilyMedium, fontSize: 11 },
      }}
    >
      {screens}
    </Tabs>
  );
}
