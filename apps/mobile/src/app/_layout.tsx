import '../../global.css';
import { useEffect, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Font from 'expo-font';
import * as Sora from '@expo-google-fonts/sora';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@rn-primitives/portal';
import { useAuth , AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider, NAV_THEME } from '@/lib/theme';
import { palette } from '@/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  // Display font (Sora 600) — single load point; fallback type renders while loading.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    Font.loadAsync({ Sora_600SemiBold: Sora.Sora_600SemiBold })
      .then(() => setFontsReady(true))
      .catch(() => setFontsReady(true)); // never block the app on a font
  }, []);

  if (!fontsReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Light is the app's active theme (see global.css). */}
        <StatusBar style="light" />
        <AuthRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  // Redirect pattern — the recommended Expo Router auth flow.
  // The conditional Stack.Screen swap does NOT remount on auth change,
  // which is why the logout button appeared to do nothing.
  return (
    <View style={styles.root}>
      <ThemeProvider value={NAV_THEME.light}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(auth)" />
        </Stack>
        {!isAuthenticated && <Redirect href="/(auth)/login" />}
        {isAuthenticated && <Redirect href="/(app)" />}
      </ThemeProvider>
      <PortalHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
});
