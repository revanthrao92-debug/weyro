import { View, Text, FlatList, ActivityIndicator } from 'react-native';

export default function ActivityScreen() {
  const activities = [
    { id: 'a1', action: 'Provider verified', actor: 'Admin', timestamp: '2026-10-20T10:00:00Z' },
    { id: 'a2', action: 'Payment released', actor: 'Admin', timestamp: '2026-10-20T09:30:00Z' },
    { id: 'a3', action: 'Provider registered', actor: 'System', timestamp: '2026-10-20T08:15:00Z' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity Logs</Text>
        <Text style={styles.subtitle}>Platform activity audit trail</Text>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.action}>{item.action}</Text>
            <Text style={styles.actor}>{item.actor}</Text>
            <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = {
  header: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  action: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  actor: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  timestamp: { fontSize: 12, color: '#9CA3AF' },
} as any;
