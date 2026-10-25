import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { ListItem, Badge, ScreenContainer, AppHeader, EmptyState, Skeleton } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import { useChatThreads } from '@/hooks/useChatThreads';

export default function MessagesScreen() {
  const router = useRouter();
  const { data, isLoading } = useChatThreads();
  const threads = data?.items ?? [];

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark">
        <AppHeader title="Messages" subtitle="Your conversations" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={56} />
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="Messages" subtitle="Your conversations" />

      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={<MessageCircle size={28} color={palette.textMuted} />}
            title="No conversations yet"
            message="Chats with providers will appear here."
          />
        }
        renderItem={({ item }) => (
          <ListItem
            key={item.id}
            title={item.customer?.firstName || 'Customer'}
            subtitle={item.lastMessage ?? 'No messages yet'}
            right={
              <View style={styles.meta}>
                <Text style={styles.timestamp}>
                  {item.lastMessageAt
                    ? new Date(item.lastMessageAt).toLocaleDateString()
                    : '—'}
                </Text>
                {item.unreadCount > 0 ? (
                  <Badge value={String(item.unreadCount)} />
                ) : null}
              </View>
            }
            onPress={() => router.push(`/messages/${item.id}`)}
            accessibilityLabel={`Conversation with ${item.customer?.firstName}`}
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
});
