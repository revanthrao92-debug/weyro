import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  ChatMessage,
  chatStore,
  useChatThread,
} from '@/services/chat-store';

const QUICK_PROMPTS = [
  'Is this genuine OEM grade?',
  'Can you send a photo of the actual part?',
  'Does the quote include warranty?',
  'Can you do doorstep delivery & fitment?',
];

export default function ChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    threadId?: string;
    requestId?: string;
    providerName?: string;
    customerName?: string;
    damagedPart?: string;
    vehicle?: string;
    role?: 'CUSTOMER' | 'PROVIDER';
  }>();

  // Determine active thread
  const resolvedThreadId =
    params.threadId ||
    `${params.requestId || 'req_seed_01'}_${params.providerName || 'Apex OEM Auto Dismantlers'}`;

  // Ensure thread exists
  const activeThread =
    useChatThread(resolvedThreadId) ||
    chatStore.getOrCreateThread({
      requestId: params.requestId || 'req_seed_01',
      providerName: params.providerName || 'Apex OEM Auto Dismantlers',
      customerName: params.customerName || 'Marcus Vance',
      damagedPart: params.damagedPart || 'Front Bumper & Headlight Assembly',
      vehicle: params.vehicle || '2022 BMW 330i M-Sport',
    });

  const [activeRole, setActiveRole] = useState<'CUSTOMER' | 'PROVIDER'>(
    params.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER'
  );
  const [inputText, setInputText] = useState('');

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const senderName =
      activeRole === 'CUSTOMER'
        ? activeThread.customerName
        : activeThread.providerName;

    chatStore.sendMessage(activeThread.id, activeRole, senderName, text);
    setInputText('');
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isCustomer = item.senderRole === 'CUSTOMER';
    const isMe = item.senderRole === activeRole;

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowOther,
        ]}>
        <View
          style={[
            styles.messageBubble,
            isCustomer ? styles.customerBubble : styles.providerBubble,
          ]}>
          <ThemedText
            type="smallBold"
            style={[
              styles.senderBadge,
              isCustomer ? styles.customerSenderText : styles.providerSenderText,
            ]}>
            {item.senderName} ({item.senderRole})
          </ThemedText>

          <ThemedText style={styles.messageText}>{item.text}</ThemedText>

          <ThemedText style={styles.timestampText}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <ThemedView
        type="backgroundElement"
        style={[
          styles.headerContainer,
          { paddingTop: insets.top + Spacing.two },
        ]}>
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText style={styles.backButtonText}>‹ Back</ThemedText>
          </Pressable>

          <View style={styles.headerTitleBox}>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              {activeThread.providerName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.headerSubtitle}>
              {activeThread.vehicle} • {activeThread.damagedPart}
            </ThemedText>
          </View>
        </View>

        {/* Role Toggle Switch for Testing */}
        <View style={styles.roleToggleRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Replying as:
          </ThemedText>
          <View style={styles.roleTogglePills}>
            <Pressable
              onPress={() => setActiveRole('CUSTOMER')}
              style={[
                styles.rolePill,
                activeRole === 'CUSTOMER' && styles.rolePillActive,
              ]}>
              <ThemedText
                type="small"
                style={[
                  styles.rolePillText,
                  activeRole === 'CUSTOMER' && styles.rolePillTextActive,
                ]}>
                Customer ({activeThread.customerName.split(' ')[0]})
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setActiveRole('PROVIDER')}
              style={[
                styles.rolePill,
                activeRole === 'PROVIDER' && styles.rolePillActive,
              ]}>
              <ThemedText
                type="small"
                style={[
                  styles.rolePillText,
                  activeRole === 'PROVIDER' && styles.rolePillTextActive,
                ]}>
                Provider ({activeThread.providerName.split(' ')[0]})
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>

      {/* Messages List */}
      <FlatList
        data={activeThread.messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Spacing.four },
        ]}
      />

      {/* Quick Prompts */}
      <View style={styles.quickPromptsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={QUICK_PROMPTS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.quickPromptsList}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSend(item)}
              style={({ pressed }) => [
                styles.promptChip,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small" style={styles.promptChipText}>
                {item}
              </ThemedText>
            </Pressable>
          )}
        />
      </View>

      {/* Message Input Bar */}
      <ThemedView
        type="backgroundElement"
        style={[
          styles.inputBarContainer,
          {
            paddingBottom: insets.bottom + BottomTabInset,
          },
        ]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Message as ${activeRole === 'CUSTOMER' ? 'Customer' : 'Provider'}...`}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.chatInput,
            {
              color: theme.text,
              backgroundColor: theme.background,
              borderColor: theme.textSecondary,
            },
          ]}
        />

        <Pressable
          onPress={() => handleSend()}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && styles.pressed,
          ]}>
          <ThemedText style={styles.sendButtonText}>Send 📨</ThemedText>
        </Pressable>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    gap: Spacing.two,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F52BA',
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  roleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  roleTogglePills: {
    flexDirection: 'row',
    gap: 4,
  },
  rolePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  rolePillActive: {
    backgroundColor: '#0F52BA',
    borderColor: '#0F52BA',
  },
  rolePillText: {
    fontSize: 11,
  },
  rolePillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.two,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    padding: Spacing.three,
    borderRadius: 14,
    gap: 4,
  },
  customerBubble: {
    backgroundColor: '#0F52BA',
    borderBottomRightRadius: 2,
  },
  providerBubble: {
    backgroundColor: '#2E3135',
    borderBottomLeftRadius: 2,
  },
  senderBadge: {
    fontSize: 11,
  },
  customerSenderText: {
    color: '#93C5FD',
  },
  providerSenderText: {
    color: '#A7F3D0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#ffffff',
  },
  timestampText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    alignSelf: 'flex-end',
  },
  quickPromptsContainer: {
    paddingVertical: Spacing.one,
  },
  quickPromptsList: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  promptChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  promptChipText: {
    fontSize: 12,
  },
  inputBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#0F52BA',
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.8,
  },
});
