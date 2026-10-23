import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/hooks/useAuth';
import { palette } from '@/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
    <Stack>
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
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
});
