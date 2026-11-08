import { useState } from 'react';
import { FlatList, StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, Search } from 'lucide-react-native';
import { Avatar, Badge, ScreenContainer, AppHeader, EmptyState, Skeleton } from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';
import { useChatThreads } from '@/hooks/useChatThreads';

/**
 * Messages — reference photo 9.
 * White search bar under the dark header, then conversation rows:
 * circular avatar, bold name + time, preview line, teal unread badge.
 */
export default function MessagesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useChatThreads();

  const threads = (data?.items ?? []).filter((t) => {
    if (!query.trim()) return true;
    const who = t.customer?.firstName ?? '';
    return who.toLowerCase().includes(query.toLowerCase()) ||
      (t.lastMessage ?? '').toLowerCase().includes(query.toLowerCase());
  });

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
      <AppHeader title="Messages" />

      {/* Search — photo's rounded search field */}
      <View style={styles.searchWrap}>
        <Search size={16} color={palette.textMuted} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations…"
          placeholderTextColor={palette.textMuted}
          style={styles.searchInput}
          accessibilityLabel="Search conversations"
        />
      </View>

      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon={<MessageCircle size={28} color={palette.textMuted} />}
            title={query ? 'No matching conversations' : 'No conversations yet'}
            message="Chats with providers will appear here."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/messages/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation with ${item.customer?.firstName ?? 'customer'}`}
            accessibilityHint="Opens the chat thread"
            className="active:opacity-60"
            style={styles.row}
          >
            <Avatar name={item.customer?.firstName ?? 'W'} size={44} />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={2}>
                {item.customer?.firstName || 'Customer'}
              </Text>
              <Text style={styles.preview} numberOfLines={1} maxFontSizeMultiplier={2}>
                {item.lastMessage ?? 'No messages yet'}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.timestamp}>
                {item.lastMessageAt
                  ? new Date(item.lastMessageAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })
                  : '—'}
              </Text>
              {item.unreadCount > 0 ? <Badge value={String(item.unreadCount)} /> : null}
            </View>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 40,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.caption,
    color: palette.textPrimary,
    paddingVertical: 0,
  },
  list: { paddingBottom: spacing.xxl, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rowText: { flex: 1, gap: 2 },
  name: { ...typography.bodyMedium, color: palette.textPrimary },
  preview: { ...typography.caption, color: palette.textSecondary },
  meta: { alignItems: 'flex-end', gap: spacing.xs },
  timestamp: { ...typography.label, color: palette.textMuted },
});
