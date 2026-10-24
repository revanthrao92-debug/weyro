import { Tabs } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { palette, fontFamilyMedium } from '@/theme';

// Every route in the (app) group must be declared: a Tabs.Screen with a title
// shows the tab, with `href: null` keeps the route but hides it (expo-router
// JS tabs auto-register every file in the group as a tab otherwise).
export default function AppLayout() {
  const { role } = useAuth();

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
      {role === 'ADMIN' ? (
        <>
          <Tabs.Screen name="index" options={{ title: 'Overview' }} />
          <Tabs.Screen name="providers" options={{ title: 'Providers' }} />
          <Tabs.Screen name="escrow" options={{ title: 'Escrow Ledger' }} />
          <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
          <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
          <Tabs.Screen name="bookings" options={{ href: null }} />
          <Tabs.Screen name="messages" options={{ href: null }} />
          <Tabs.Screen name="shop" options={{ href: null }} />
          <Tabs.Screen name="opportunities" options={{ href: null }} />
          <Tabs.Screen name="orders" options={{ href: null }} />
        </>
      ) : role === 'PROVIDER' || role === 'BOTH' ? (
        <>
          <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
          <Tabs.Screen name="opportunities" options={{ title: 'Opportunities' }} />
          <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
          <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
          <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
          <Tabs.Screen name="providers" options={{ href: null }} />
          <Tabs.Screen name="escrow" options={{ href: null }} />
          <Tabs.Screen name="activity" options={{ href: null }} />
          <Tabs.Screen name="bookings" options={{ href: null }} />
          <Tabs.Screen name="shop" options={{ href: null }} />
        </>
      ) : (
        <>
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
          <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
          <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
          <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
          <Tabs.Screen name="providers" options={{ href: null }} />
          <Tabs.Screen name="escrow" options={{ href: null }} />
          <Tabs.Screen name="activity" options={{ href: null }} />
          <Tabs.Screen name="opportunities" options={{ href: null }} />
          <Tabs.Screen name="orders" options={{ href: null }} />
        </>
      )}
    </Tabs>
  );
}
