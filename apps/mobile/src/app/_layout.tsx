import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { AuthProvider } from '@/hooks/useAuth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthRouter />
    </AuthProvider>
  );
}

function AuthRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </SafeAreaView>
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
