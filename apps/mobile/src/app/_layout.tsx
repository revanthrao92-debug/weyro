import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setReady(true);
    }
  }, [isLoading]);

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </SafeAreaView>
    );
  }

  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
