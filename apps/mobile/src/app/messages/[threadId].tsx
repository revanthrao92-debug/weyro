import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScreenContainer,
  BackButton,
  PressableScale,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import {
  palette,
  spacing,
  radii,
  typography,
  fontFamilyMono,
} from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  useChatMessages,
  useChatThreads,
  useMarkThreadRead,
  useSendChatMessage,
  type ChatMessage,
} from '@/hooks/useChatThreads';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function MessagesThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const id = threadId ?? '';

  const { data: threadsData } = useChatThreads();
  const { data, isLoading } = useChatMessages(id);
  const sendMessage = useSendChatMessage(id);
  const markRead = useMarkThreadRead(id);

  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const marked = useRef(false);

  const thread = (threadsData?.items ?? []).find((t) => t.id === id);
  const title =
    role === 'PROVIDER'
      ? thread?.customer?.firstName ?? 'Customer'
      : thread?.provider?.businessName ?? 'Conversation';

  const messages = data?.items ?? [];

  useEffect(() => {
    if (!id || marked.current || messages.length === 0) return;
    marked.current = true;
    if (messages.some((m) => !m.readAt)) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages.length]);

  const submit = async () => {
    const content = text.trim();
    if (!content || sendMessage.isPending) return;
    setText('');
    try {
      await sendMessage.mutateAsync(content);
    } catch (e: any) {
      setText(content);
      Alert.alert('Message not sent', e?.message ?? 'Try again');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScreenContainer chrome="dark" padded={false} safeBottom>
        <View style={styles.topBar}>
          <BackButton />
          <View style={styles.topText}>
            <Text style={styles.topLabel}>Conversation</Text>
            <Text style={styles.topTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <View style={styles.spacer} />
        </View>

        {isLoading ? (
          <View style={styles.body}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={i % 2 ? '55%' : '70%'} height={40} style={{ marginTop: 12 }} />
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState
                title="No messages yet"
                message="Send the first message to start the conversation."
              />
            }
            renderItem={({ item }) => {
              const mine =
                (role === 'PROVIDER' && item.senderRole === 'PROVIDER') ||
                (role !== 'PROVIDER' && item.senderRole === 'CUSTOMER');
              return (
                <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={styles.messageText}>{item.content}</Text>
                    <Text style={styles.time}>{time(item.createdAt)}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}
      </ScreenContainer>

      <View
        style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={palette.textMuted}
          style={styles.input}
          multiline
          accessibilityLabel="Message"
        />
        <PressableScale
          onPress={() => void submit()}
          disabled={!text.trim() || sendMessage.isPending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          scaleTo={0.92}
          style={[styles.send, (!text.trim() || sendMessage.isPending) && styles.sendDisabled]}
        >
          <Send size={18} color={palette.onAccent} strokeWidth={2} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  topText: { flex: 1 },
  topLabel: { ...typography.label, color: palette.textMuted },
  topTitle: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: 1 },
  spacer: { width: 0 },
  body: { paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleMine: {
    backgroundColor: palette.surfaceAlt,
    borderColor: palette.borderStrong,
  },
  bubbleTheirs: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
  },
  messageText: { ...typography.body, color: palette.textPrimary },
  time: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.canvas,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    ...typography.body,
    color: palette.textPrimary,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
