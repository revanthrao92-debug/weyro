import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View, StyleSheet } from 'react-native';
import { Input, Button, ScreenContainer, AppHeader, BackButton } from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

export default function MessagesThreadScreen() {
  const [messageText, setMessageText] = useState('');

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
          renderItem={({ item }) => (
            <View style={[styles.messageRow, item.sender === 'customer' ? styles.rowCustomer : styles.rowProvider]}>
              <View style={[styles.bubble, item.sender === 'customer' ? styles.bubbleCustomer : styles.bubbleProvider]}>
                <Text style={[styles.messageText, item.sender === 'customer' ? styles.messageTextCustomer : styles.messageTextProvider]} numberOfLines={4}>
                  {item.text}
                </Text>
              </View>
              <Text style={styles.messageTime}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
        />
      </ScreenContainer>

      <View style={styles.inputContainer}>
        <Input
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          accessibilityLabel="Message input"
          accessibilityRole="text"
          style={styles.input}
          maxFontSizeMultiplier={2}
        />
        <Button title="Send" onPress={() => {}} variant="secondary" style={styles.sendBtn} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  rowProvider: { justifyContent: 'flex-start' },
  rowCustomer: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  bubbleProvider: { backgroundColor: palette.surfaceAlt },
  bubbleCustomer: { backgroundColor: palette.accent },
  messageText: { ...typography.body, marginBottom: spacing.xs },
  messageTextProvider: { color: palette.textPrimary },
  messageTextCustomer: { color: palette.onAccent },
  messageTime: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
    gap: spacing.sm,
    ...(Platform.OS === 'ios' && { paddingBottom: spacing.lg }),
  },
  input: {
    flex: 1,
    minHeight: 44,
    ...typography.body,
    color: palette.textPrimary,
    backgroundColor: palette.surfaceAlt,
  },
  sendBtn: { minWidth: 88 },
});
