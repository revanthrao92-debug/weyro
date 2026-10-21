import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

import { useEffect } from 'react';
import { registerForPushNotificationsAsync } from '@/services/notifications';
import { useAuth } from '@/services/auth-store';
import { damageRequestStore } from '@/services/damage-request-store';
import { chatStore } from '@/services/chat-store';
import { offlineQueue } from '@/services/offline-queue';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const auth = useAuth();

  useEffect(() => {
    registerForPushNotificationsAsync().catch(() => {});
  }, []);

  // Reload server data when a session appears, and drop cached marketplace data
  // on logout so a second account on the same device cannot see the first user's
  // requests, bookings, or chats.
  useEffect(() => {
    if (!auth.isInitialized) return;

    if (auth.isAuthenticated) {
      damageRequestStore.syncWithBackend().catch(() => {});
      chatStore.syncWithBackend().catch(() => {});
    } else {
      damageRequestStore.clearLocalState().catch(() => {});
      chatStore.clearLocalState();
      offlineQueue.clear().catch(() => {});
    }
  }, [auth.isAuthenticated, auth.isInitialized]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
