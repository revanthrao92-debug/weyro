import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../hooks/useAuth';

/**
 * Entry — MINIMUM REQUIRED STRUCTURE ONLY.
 *
 * The former Weyro presentation layer (screens, components, styling
 * system, imagery) was removed on purpose for the "complete existing UI
 * removal" task. No replacement interface exists yet.
 *
 * Preserved below: React Query (server state) and AuthProvider
 * (authentication + session/refresh logic wired to the live API).
 */
const queryClient = new QueryClient();

function BootStatus() {
  const { isAuthenticated, user } = useAuth();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Weyro — UI intentionally removed</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Frontend UI</Text>
        <Text style={styles.value}>Removed (new build pending)</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Auth Provider</Text>
        <Text style={styles.value}>Active</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Query client</Text>
        <Text style={styles.value}>Active</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Session</Text>
        <Text style={styles.value}>
          {isAuthenticated && user ? 'Signed in' : 'Signed out'}
        </Text>
      </View>
      <Text style={styles.note}>
        Business logic, hooks and API services remain intact.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#080B0E',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: { color: '#F5F6F7', fontSize: 20, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  label: { width: 110, color: '#6E7A84' },
  value: { color: '#F5F6F7', flex: 1 },
  note: { color: '#6E7A84', marginTop: 24, fontSize: 12 },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
        {/* Boot status is informational only — not a replacement UI. */}
        <BootStatus />
      </AuthProvider>
    </QueryClientProvider>
  );
}
