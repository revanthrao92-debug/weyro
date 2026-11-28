import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { palette } from '@/theme';

/**
 * Pull-to-refresh for a list or ScrollView: pass the query's `refetch`, put the
 * result in `refreshControl`. Tracks its own spinner state so background
 * refetches don't flash the spinner.
 */
export function useRefreshControl(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={palette.textSecondary}
    />
  );
}
