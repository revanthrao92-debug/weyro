import { useSyncExternalStore } from 'react';
import { weyroNotifications } from './notifications';
import { apiClient } from './api-client';

export interface ChatMessage {
  id: string;
  threadId: string;
  senderRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  senderName: string;
  text: string;
  timestamp: string;
  imageUrl?: string;
}

export interface ChatThread {
  id: string;
  requestId: string;
  providerName: string;
  customerName: string;
  damagedPart: string;
  vehicle: string;
  messages: ChatMessage[];
  lastMessageAt: string;
}

type Listener = () => void;
let listeners: Listener[] = [];

// Initialize clean empty threads state - no dummy/mock seed data
let threads: ChatThread[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const chatStore = {
  getThreads(): ChatThread[] {
    return threads;
  },

  getThread(threadId: string): ChatThread | undefined {
    return threads.find((t) => t.id === threadId);
  },

  getOrCreateThread(params: {
    requestId: string;
    providerName: string;
    customerName: string;
    damagedPart: string;
    vehicle: string;
  }): ChatThread {
    const threadId = `${params.requestId}_${params.providerName}`;
    const existing = threads.find((t) => t.id === threadId);
    if (existing) return existing;

    const newThread: ChatThread = {
      id: threadId,
      requestId: params.requestId,
      providerName: params.providerName,
      customerName: params.customerName,
      damagedPart: params.damagedPart,
      vehicle: params.vehicle,
      messages: [],
      lastMessageAt: new Date().toISOString(),
    };

    threads = [newThread, ...threads];
    emitChange();
    return newThread;
  },

  sendMessage(
    threadId: string,
    senderRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN',
    senderName: string,
    text: string,
    imageUrl?: string,
  ): ChatMessage {
    const threadIndex = threads.findIndex((t) => t.id === threadId);
    const now = new Date().toISOString();

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      threadId,
      senderRole,
      senderName,
      text,
      timestamp: now,
      imageUrl,
    };

    if (threadIndex !== -1) {
      const targetThread = threads[threadIndex];
      const updatedThread: ChatThread = {
        ...targetThread,
        lastMessageAt: now,
        messages: [...targetThread.messages, newMessage],
      };
      threads = [
        updatedThread,
        ...threads.slice(0, threadIndex),
        ...threads.slice(threadIndex + 1),
      ];
    } else {
      threads = [
        {
          id: threadId,
          requestId: threadId.split('_')[0] || '',
          providerName: senderRole === 'PROVIDER' ? senderName : 'Service Provider',
          customerName: senderRole === 'CUSTOMER' ? senderName : 'Customer',
          damagedPart: 'Service Request',
          vehicle: 'Vehicle',
          messages: [newMessage],
          lastMessageAt: now,
        },
        ...threads,
      ];
    }

    emitChange();

    // Trigger local push notification for demo/feedback
    weyroNotifications.chatMessageReceived(senderName, text);

    return newMessage;
  },

  async syncWithBackend(): Promise<void> {
    try {
      const res = await apiClient.get<any>('/chat/threads');
      if (res?.items && Array.isArray(res.items)) {
        threads = res.items.map((item: any) => ({
          id: item.id,
          requestId: item.requestId || '',
          providerName: item.provider?.businessName || 'Provider',
          customerName: `${item.customer?.firstName || 'Customer'} ${item.customer?.lastName || ''}`.trim(),
          damagedPart: item.request?.title || 'Service Request',
          vehicle: 'Vehicle',
          messages: (item.messages || []).map((m: any) => ({
            id: m.id,
            threadId: item.id,
            senderRole: m.senderRole,
            senderName: m.senderRole === 'CUSTOMER' ? item.customer?.firstName : item.provider?.businessName,
            text: m.content,
            timestamp: m.createdAt,
          })),
          lastMessageAt: item.lastMessageAt || item.createdAt,
        }));
        emitChange();
      }
    } catch {
      // Backend not yet authenticated or offline
    }
  },

  subscribe(listener: Listener): () => void {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

export function useChatThreads(): ChatThread[] {
  return useSyncExternalStore(
    chatStore.subscribe,
    chatStore.getThreads,
    chatStore.getThreads,
  );
}

export function useChatThread(threadId: string): ChatThread | undefined {
  return useSyncExternalStore(
    chatStore.subscribe,
    () => chatStore.getThread(threadId),
    () => chatStore.getThread(threadId),
  );
}
