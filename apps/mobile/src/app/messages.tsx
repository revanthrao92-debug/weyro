import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

export default function MessagesScreen() {
  const router = useRouter();
  const threads = [
    { id: 't1', providerName: 'Sharma Motors', lastMessage: 'Your booking is confirmed', lastMessageAt: '2026-10-20T10:00:00Z', unreadCount: 1 },
    { id: 't2', providerName: 'Auto Care Center', lastMessage: 'Quote sent for brake repair', lastMessageAt: '2026-10-19T15:30:00Z', unreadCount: 0 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Your conversations</Text>
      </View>

      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/messages/${item.id}`)}
            accessibilityLabel={`Conversation with ${item.providerName}`}
            accessibilityRole="button"
          >
            <View style={styles.cardContent}>
              <Text style={styles.providerName}>{item.providerName}</Text>
              <Text style={styles.lastMessage}>{item.lastMessage}</Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.timestamp}>{new Date(item.lastMessageAt).toLocaleDateString()}</Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: { flex: 1 },
  providerName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  lastMessage: { fontSize: 14, color: '#6B7280' },
  meta: { alignItems: 'flex-end' },
  timestamp: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  unreadBadge: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
} as any;
