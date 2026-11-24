import '../../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@rn-primitives/portal';
import { useAuth , AuthProvider } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeProvider, NAV_THEME } from '@/lib/theme';
import { palette } from '@/theme';
import { flushOfflineQueue } from '@/services/offline-queue';
import { initSentry } from '@/lib/sentry';
// Registers the background location task at module scope (required by Expo Router + TaskManager).
import '@/services/background-location';
import { useFonts, Sora_600SemiBold } from '@expo-google-fonts/sora';
import { shouldRetryQuery } from '@/services/api-client';
import * as Notifications from 'expo-notifications';
import { notificationHref } from '@/lib/notificationHref';

// M9: crash reporting (off unless EXPO_PUBLIC_SENTRY_DSN is set).
initSentry();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetryQuery } },
});

export default function RootLayout() {
  // Registers the display face used by typography.display (Sora 600).
  // Non-blocking: text falls back to the system face for the first frames.
  useFonts({ Sora_600SemiBold });

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* Light is the app's active theme (see global.css). */}
          <StatusBar style="dark" />
          <ErrorBoundary>
            <AuthRouter />
          </ErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Tapping a push notification opens the screen it is about (also when the tap
 * cold-starts the app); same mapping as the in-app notification list.
 * Native only: the response API throws UnavailabilityError on web.
 */
function NotificationTapRouter() {
  const { isAuthenticated, role } = useAuth();
  const router = useRouter();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!isAuthenticated || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = lastResponse.notification.request.content.data as Record<string, unknown> | null;
    Notifications.clearLastNotificationResponse();
    const href = notificationHref(data ?? null, role);
    if (href) router.push(href as never);
  }, [isAuthenticated, lastResponse, role, router]);

  return null;
}

function AuthRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [isAuthenticated, isLoading, router, segments]);

  // Retry queued (non-financial) writes when the session starts and whenever
  // the app returns to the foreground.
  useEffect(() => {
    if (!isAuthenticated) return;
    const sync = () => {
      void flushOfflineQueue().then((synced) => {
        if (synced > 0) {
          void queryClient.invalidateQueries({ queryKey: ['myRequests'] });
          void queryClient.invalidateQueries({ queryKey: ['broadcastFeed'] });
        }
      });
    };
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ThemeProvider value={NAV_THEME.light}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
      {Platform.OS !== 'web' ? <NotificationTapRouter /> : null}
      {/* RNR portal host — must stay the last child of the providers. */}
      <PortalHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
});
