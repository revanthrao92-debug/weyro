import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { palette } from '@/theme';

/**
 * `/` resolves the entry stack once auth bootstrap completes. Navigation is
 * performed after mount rather than during render: a render-time Redirect
 * here loops against the declarative auth guards in the root Stack.
 */
export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isAuthenticated ? '/(app)' : '/(auth)/login');
  }, [isAuthenticated, isLoading, router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvas,
  },
});
