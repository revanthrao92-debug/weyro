import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, Search } from 'lucide-react-native';
import {
  ScreenContainer,
  Avatar,
  PressableScale,
  EmptyState,
  Skeleton,
  Button,
} from '@/components/ui';
import {
  palette,
  spacing,
  typography,
  displayFamily,
  fontFamilyMono,
} from '@/theme';
import { useChatThreads } from '@/hooks/useChatThreads';

const timeLabel = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : '—';

export default function MessagesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useChatThreads();

  const allThreads = data?.items ?? [];
  const threads = allThreads.filter((t) => {
    if (!query.trim()) return true;
    const who = t.customer?.firstName ?? '';
    return (
      who.toLowerCase().includes(query.toLowerCase()) ||
      (t.lastMessage ?? '').toLowerCase().includes(query.toLowerCase())
    );
  });
  const unread = allThreads.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0);

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <FlatList
        data={isLoading ? [] : threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>Inbox</Text>
            <Text style={styles.title}>Messages</Text>
            <Text style={styles.summary}>
              {allThreads.length === 0
                ? 'No conversations yet'
                : `${allThreads.length} conversations · ${unread} unread`}
            </Text>

            <View style={styles.search}>
              <Search size={15} color={palette.textMuted} strokeWidth={2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={palette.textMuted}
                style={styles.searchInput}
                accessibilityLabel="Search conversations"
              />
            </View>

            {isLoading ? (
              <View>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                    <Skeleton width={40} height={40} radius={20} />
                    <View style={styles.rowText}>
                      <Skeleton width="45%" height={14} />
                      <Skeleton width="75%" height={10} style={{ marginTop: 6 }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <View style={styles.empty}>
              <EmptyState
                icon={<MessageCircle size={26} color={palette.textMuted} strokeWidth={1.7} />}
                title={query ? 'No matching conversations' : 'No conversations yet'}
                message={
                  query
                    ? 'Try a different name or message.'
                    : 'Chats open automatically when you accept a quote.'
                }
                action={
                  query ? undefined : (
                    <Button
                      title="Post a request"
                      onPress={() => router.push('/requests/create')}
                    />
                  )
                }
              />
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <PressableScale
            onPress={() => router.push(`/messages/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation with ${item.customer?.firstName ?? 'customer'}`}
            scaleTo={0.99}
            style={[styles.row, index > 0 && styles.divider]}
          >
            <Avatar name={item.customer?.firstName ?? 'W'} size={40} />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.customer?.firstName || 'Conversation'}
              </Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessage ?? 'No messages yet'}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.time}>{timeLabel(item.lastMessageAt ?? undefined)}</Text>
              {item.unreadCount > 0 ? (
                <Text style={styles.unread}>{item.unreadCount}</Text>
              ) : null}
            </View>
          </PressableScale>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 104 },
  eyebrow: { ...typography.label, color: palette.textMuted },
  title: {
    fontFamily: displayFamily,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  summary: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  searchInput: {
    flex: 1,
    ...typography.caption,
    color: palette.textPrimary,
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowText: { flex: 1 },
  name: { ...typography.bodyMedium, color: palette.textPrimary },
  preview: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  meta: { alignItems: 'flex-end', gap: 4 },
  time: { fontFamily: fontFamilyMono, fontSize: 10, color: palette.textMuted },
  unread: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.onAccent,
    backgroundColor: palette.accent,
    minWidth: 18,
    textAlign: 'center',
    borderRadius: 9,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  empty: { marginTop: spacing.lg },
});
