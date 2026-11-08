import { FlatList, StyleSheet, Text } from 'react-native';
import { ScreenContainer, Card, AppHeader, EmptyState } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

export default function ActivityScreen() {
  const activities = [
    { id: 'a1', action: 'Provider verified', actor: 'Admin', timestamp: '2026-10-20T10:00:00Z' },
    { id: 'a2', action: 'Payment released', actor: 'Admin', timestamp: '2026-10-20T09:30:00Z' },
    { id: 'a3', action: 'Provider registered', actor: 'System', timestamp: '2026-10-20T08:15:00Z' },
  ];

  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="Activity Logs" subtitle="Platform activity audit trail" />
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState title="No activity yet" message="Platform events will show up here." />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.action}>{item.action}</Text>
            <Text style={styles.actor}>{item.actor}</Text>
            <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xl },
  card: { marginBottom: spacing.md },
  action: { ...typography.bodyMedium, color: palette.textPrimary, marginBottom: 2 },
  actor: { ...typography.caption, color: palette.textSecondary, marginBottom: 2 },
  timestamp: { ...typography.label, color: palette.textMuted },
});
