import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListItem, Badge, ScreenContainer, AppHeader } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

export default function MessagesScreen() {
  const router = useRouter();
  const threads = [
    { id: 't1', providerName: 'Sharma Motors', lastMessage: 'Your booking is confirmed', lastMessageAt: '2026-10-20T10:00:00Z', unreadCount: 1 },
    { id: 't2', providerName: 'Auto Care Center', lastMessage: 'Quote sent for brake repair', lastMessageAt: '2026-10-19T15:30:00Z', unreadCount: 0 },
  ];

  return (
    <ScreenContainer>
      <AppHeader title="Messages" subtitle="Your conversations" />

      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No conversations yet</Text>
        }
        renderItem={({ item }) => (
          <ListItem
            key={item.id}
            title={item.providerName}
            subtitle={item.lastMessage}
            right={
              <View style={styles.meta}>
                <Text style={styles.timestamp}>{new Date(item.lastMessageAt).toLocaleDateString()}</Text>
                {item.unreadCount > 0 ? <Badge value={String(item.unreadCount)} /> : null}
              </View>
            }
            onPress={() => router.push(`/messages/${item.id}`)}
            accessibilityLabel={`Conversation with ${item.providerName}`}
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timestamp: { ...typography.label, color: palette.textMuted },
  emptyText: { ...typography.caption, color: palette.textMuted, textAlign: 'center' },
});
