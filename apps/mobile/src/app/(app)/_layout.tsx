import { Tabs } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { palette, fontFamilyMedium } from '@/theme';

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
          <Tabs.Screen
            name="providers"
            options={{ title: 'Providers' }}
          />
          <Tabs.Screen
            name="escrow"
            options={{ title: 'Escrow Ledger' }}
          />
          <Tabs.Screen
            name="notifications"
            options={{ title: 'Notifications' }}
          />
          <Tabs.Screen
            name="profile"
            options={{ title: 'Profile' }}
          />
        </>
      ) : role === 'PROVIDER' || role === 'BOTH' ? (
        <>
          <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
          <Tabs.Screen
            name="opportunities"
            options={{ title: 'Opportunities' }}
          />
          <Tabs.Screen
            name="orders"
            options={{ title: 'Orders' }}
          />
          <Tabs.Screen
            name="messages"
            options={{ title: 'Messages' }}
          />
          <Tabs.Screen
            name="notifications"
            options={{ title: 'Notifications' }}
          />
          <Tabs.Screen
            name="profile"
            options={{ title: 'Profile' }}
          />
        </>
      ) : (
        <>
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen
            name="bookings"
            options={{ title: 'Bookings' }}
          />
          <Tabs.Screen
            name="messages"
            options={{ title: 'Messages' }}
          />
          <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
          <Tabs.Screen
            name="notifications"
            options={{ title: 'Notifications' }}
          />
          <Tabs.Screen
            name="profile"
            options={{ title: 'Profile' }}
          />
        </>
      )}
    </Tabs>
  );
}
