import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

/**
 * `/` is the entry point. Send the user to the right stack based on the
 * persisted session instead of rendering the old UI-removed placeholder.
 */
export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return <Redirect href={isAuthenticated ? '/(app)' : '/(auth)/login'} />;
}
