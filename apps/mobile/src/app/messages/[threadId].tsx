import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList, KeyboardAvoidingView, Platform, Text, View, StyleSheet } from 'react-native';
import { Input, Button, ScreenContainer, AppHeader, BackButton } from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

export default function MessagesThreadScreen() {
  const [messageText, setMessageText] = useState('');
  const insets = useSafeAreaInsets();

  const messages = [
    { id: 'm1', sender: 'provider', text: 'Hi, I received your request. Can you share more photos?', createdAt: '2026-10-20T09:00:00Z', read: true },
    { id: 'm2', sender: 'customer', text: 'Sure, here are the additional photos.', createdAt: '2026-10-20T09:15:00Z', read: true },
    { id: 'm3', sender: 'provider', text: 'Great, I can do the repair for ₹2500.', createdAt: '2026-10-20T10:00:00Z', read: false },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScreenContainer padded={false}>
        <AppHeader left={<BackButton />} title="Conversation" />

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isMine = item.sender === 'customer';
            return (
              <View style={[styles.messageRow, isMine ? styles.rowMine : styles.rowTheirs]}>
                <View style={[styles.bubbleColumn, isMine ? styles.columnMine : styles.columnTheirs]}>
                  <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text
                      style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextTheirs]}
                      maxFontSizeMultiplier={2}
                    >
                      {item.text}
                    </Text>
                  </View>
                  <Text style={styles.messageTime}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      </ScreenContainer>

      <View
        style={[styles.inputContainer, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}
      >
        <Input
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          accessibilityLabel="Message input"
          containerStyle={styles.inputWrapper}
          style={styles.input}
          maxFontSizeMultiplier={2}
        />
        <Button title="Send" onPress={() => {}} style={styles.sendBtn} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },

  // Each message is a column (bubble + timestamp) on its own side.
  messageRow: { flexDirection: 'row', marginBottom: spacing.lg },
  rowTheirs: { justifyContent: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  bubbleColumn: { maxWidth: '78%' },
  columnTheirs: { alignItems: 'flex-start' },
  columnMine: { alignItems: 'flex-end' },

  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  // Incoming: white bubble + hairline so it separates from the canvas
  // (surfaceAlt was nearly identical to the canvas and vanished).
  bubbleTheirs: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderBottomLeftRadius: radii.sm,
  },
  // Outgoing: accent fill, tail on the other corner.
  bubbleMine: {
    backgroundColor: palette.accent,
    borderBottomRightRadius: radii.sm,
  },

  messageText: { ...typography.body },
  messageTextTheirs: { color: palette.textPrimary },
  messageTextMine: { color: palette.onAccent },

  messageTime: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.borderStrong,
    backgroundColor: palette.surface,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  inputWrapper: { flex: 1, marginBottom: 0 },
  input: {
    minHeight: 44,
    backgroundColor: palette.surfaceAlt,
  },
  sendBtn: { minWidth: 88 },
});
