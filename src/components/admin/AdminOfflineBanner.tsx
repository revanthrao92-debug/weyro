import React from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OfflineSyncStatus } from '@/services/offline-queue';

interface AdminOfflineBannerProps {
  status: OfflineSyncStatus;
  onFlush: () => void;
}

export function AdminOfflineBanner({ status, onFlush }: AdminOfflineBannerProps) {
  const theme = useTheme();

  if (status.pendingCount === 0 && !status.isSyncing) {
    return null;
  }

  return (
    <View style={[styles.banner, { backgroundColor: theme.warningSurface, borderColor: theme.warning }]}>
      <View style={styles.textContainer}>
        <ThemedText style={[styles.title, { color: theme.warning }]}>
          Offline Queue: {status.pendingCount} pending mutation(s)
        </ThemedText>
        <ThemedText style={styles.subtitle} themeColor="textSecondary">
          {status.isSyncing
            ? 'Synchronizing with backend...'
            : 'Changes will sync automatically or click below.'}
        </ThemedText>
      </View>

      <Pressable
        disabled={status.isSyncing}
        onPress={onFlush}
        style={[styles.syncBtn, { backgroundColor: theme.warning }]}>
        {status.isSyncing ? (
          <ActivityIndicator size="small" color={theme.inverseText} />
        ) : (
          <ThemedText style={[styles.syncBtnText, { color: theme.inverseText }]}>Sync Now</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    marginBottom: Spacing.three,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  syncBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
