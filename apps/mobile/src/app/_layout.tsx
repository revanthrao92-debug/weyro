import '../../global.css';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@rn-primitives/portal';
import { useAuth , AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider, NAV_THEME } from '@/lib/theme';
import { palette } from '@/theme';
import { useFonts, Sora_600SemiBold } from '@expo-google-fonts/sora';

const queryClient = new QueryClient();

export default function RootLayout() {
  // Registers the display face used by typography.display (Sora 600).
  // Non-blocking: text falls back to the system face for the first frames.
  useFonts({ Sora_600SemiBold });

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* Light is the app's active theme (see global.css). */}
          <StatusBar style="light" />
          <AuthRouter />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
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

  return (
    <View style={styles.root}>
      <ThemeProvider value={NAV_THEME.light}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={isAuthenticated}>
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
      {/* RNR portal host — must stay the last child of the providers. */}
      <PortalHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
});
