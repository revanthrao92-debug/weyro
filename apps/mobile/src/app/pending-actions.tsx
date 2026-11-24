import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  BackButton,
  Button,
  Card,
  EmptyState,
  ScreenContainer,
  StatusPill,
} from '@/components/ui';
import {
  flushOfflineQueue,
  listQueuedMutations,
  subscribeToQueue,
  type QueuedMutation,
} from '@/services/offline-queue';
import { palette, spacing, typography } from '@/theme';

function labelFor(item: QueuedMutation): string {
  if (item.endpoint.includes('/damage-requests')) return 'Service request';
  return `${item.method} ${item.endpoint}`;
}

export default function PendingActionsScreen() {
  const [items, setItems] = useState<QueuedMutation[]>([]);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    void listQueuedMutations().then(setItems);
    return subscribeToQueue(setItems);
  }, []);

  const retry = async () => {
    setRetrying(true);
    try {
      await flushOfflineQueue();
      setItems(await listQueuedMutations());
    } finally {
      setRetrying(false);
    }
  };

  return (
    <ScreenContainer chrome="header" padded={false} safeBottom>
      <AppHeader
        left={<BackButton />}
        title="Pending actions"
        subtitle="Saved on this device until the server confirms them"
      />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <EmptyState
            title="Nothing pending"
            message="Requests saved while offline will appear here."
          />
        ) : (
          <>
            <Text style={styles.note}>
              These actions have not reached Weyro yet. They retry when the app
              is opened with a connection. Payments are never queued.
            </Text>
            {items.map((item) => (
              <Card key={item.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.title}>{labelFor(item)}</Text>
                  <StatusPill
                    label={item.status.replace(/_/g, ' ')}
                    tone={
                      item.status === 'REQUIRES_ATTENTION' ||
                      item.status === 'FAILED'
                        ? 'danger'
                        : 'warning'
                    }
                  />
                </View>
                <Text style={styles.meta}>
                  Saved {new Date(item.createdAt).toLocaleString()} ·{' '}
                  {item.attempts} attempt{item.attempts === 1 ? '' : 's'}
                </Text>
                {item.lastError ? (
                  <Text style={styles.error}>{item.lastError}</Text>
                ) : null}
              </Card>
            ))}
            <Button
              title={retrying ? 'Retrying…' : 'Retry now'}
              onPress={retry}
              loading={retrying}
              disabled={retrying}
            />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  note: {
    ...typography.body,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  card: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { ...typography.bodyMedium, color: palette.textPrimary, flex: 1 },
  meta: { ...typography.caption, color: palette.textMuted },
  error: { ...typography.caption, color: palette.danger },
});
