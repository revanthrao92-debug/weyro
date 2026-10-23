import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

type ThreadParams = { id: string };

export default function MessagesThreadScreen() {
  const { id } = useLocalSearchParams<ThreadParams>();
  const [messageText, setMessageText] = useState('');

  const messages = [
    { id: 'm1', sender: 'provider', text: 'Hi, I received your request. Can you share more photos?', createdAt: '2026-10-20T09:00:00Z', read: true },
    { id: 'm2', sender: 'customer', text: 'Sure, here are the additional photos.', createdAt: '2026-10-20T09:15:00Z', read: true },
    { id: 'm3', sender: 'provider', text: 'Great, I can do the repair for ₹2500.', createdAt: '2026-10-20T10:00:00Z', read: false },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Conversation</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.messageContainer, item.sender === 'customer' ? styles.messageContainerCustomer : {}]}>
            <Text style={[styles.messageText, item.sender === 'customer' ? styles.messageTextCustomer : {}]}>
              {item.text}
            </Text>
            <Text style={styles.messageTime}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          accessibilityLabel="Message input"
        />
        <TouchableOpacity style={styles.sendButton} onPress={() => {}}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  header: {
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  messageContainer: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  messageContainerCustomer: {
    alignSelf: 'flex-end',
    backgroundColor: '#208AEF',
  },
  messageText: {
    fontSize: 14,
    color: '#111827',
  },
  messageTextCustomer: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sendText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
} as any;
