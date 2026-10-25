import '../../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@rn-primitives/portal';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider, NAV_THEME } from '@/lib/theme';
import { palette } from '@/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
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

  return (
    <View style={styles.root}>
      <ThemeProvider value={NAV_THEME.light}>
        <Stack screenOptions={{ headerShown: false }}>
          {isAuthenticated ? (
            <Stack.Screen
              options={{ headerShown: false }}
              name="(app)"
            />
          ) : (
            <Stack.Screen
              options={{ headerShown: false }}
              name="(auth)"
            />
          )}
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
