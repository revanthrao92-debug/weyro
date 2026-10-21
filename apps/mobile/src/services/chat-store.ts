import { useSyncExternalStore } from 'react';
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
  providerId: string;
  providerName: string;
  customerName: string;
  damagedPart: string;
  vehicle: string;
  messages: ChatMessage[];
  lastMessageAt: string;
}

type Listener = () => void;
let listeners: Listener[] = [];

let threads: ChatThread[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function customerNameOf(item: any): string {
  return `${item.customer?.firstName || 'Customer'} ${
    item.customer?.lastName || ''
  }`.trim();
}

function mapMessage(message: any, thread: ChatThread): ChatMessage {
  return {
    id: message.id,
    threadId: thread.id,
    senderRole: message.senderRole,
    senderName:
      message.senderRole === 'CUSTOMER'
        ? thread.customerName
        : message.senderRole === 'PROVIDER'
          ? thread.providerName
          : 'Weyro Support',
    text: message.content,
    timestamp: message.createdAt,
    imageUrl: message.mediaUrls?.[0],
  };
}

function mapThread(
  item: any,
  fallback?: Partial<ChatThread>,
): ChatThread {
  const customerName = item.customer ? customerNameOf(item) : fallback?.customerName || 'Customer';
  const providerName =
    item.provider?.businessName || fallback?.providerName || 'Provider';

  const thread: ChatThread = {
    id: item.id,
    requestId: item.requestId || item.request?.id || fallback?.requestId || '',
    providerId: item.providerId || item.provider?.id || fallback?.providerId || '',
    providerName,
    customerName,
    damagedPart:
      item.request?.title || fallback?.damagedPart || 'Service Request',
    vehicle: fallback?.vehicle || 'Vehicle',
    messages: [],
    lastMessageAt: item.lastMessageAt || item.createdAt,
  };

  thread.messages = (item.messages || []).map((m: any) =>
    mapMessage(m, thread),
  );

  return thread;
}

export const chatStore = {
  getThreads(): ChatThread[] {
    return threads;
  },

  getThread(threadId: string): ChatThread | undefined {
    return threads.find((t) => t.id === threadId);
  },

  async getOrCreateThread(params: {
    requestId: string;
    providerId: string;
    providerName: string;
    customerName: string;
    damagedPart: string;
    vehicle: string;
  }): Promise<ChatThread> {
    const existing = threads.find(
      (t) =>
        t.requestId === params.requestId && t.providerId === params.providerId,
    );
    if (existing) return existing;

    const res = await apiClient.post<any>('/chat/threads', {
      requestId: params.requestId,
      providerId: params.providerId,
    });

    const thread = mapThread(res, params);

    threads = [thread, ...threads.filter((t) => t.id !== thread.id)];
    emitChange();
    return thread;
  },

  async sendMessage(
    threadId: string,
    senderRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN',
    senderName: string,
    text: string,
    imageUrl?: string,
  ): Promise<ChatMessage> {
    const res = await apiClient.post<any>(
      `/chat/threads/${threadId}/messages`,
      {
        content: text,
        mediaUrls: imageUrl ? [imageUrl] : [],
      },
    );

    const thread = threads.find((t) => t.id === threadId);
    const message: ChatMessage = {
      id: res.id,
      threadId,
      senderRole: res.senderRole || senderRole,
      senderName,
      text: res.content ?? text,
      timestamp: res.createdAt || new Date().toISOString(),
      imageUrl,
    };

    if (thread) {
      threads = threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              lastMessageAt: message.timestamp,
              messages: [
                ...t.messages.filter((m) => m.id !== message.id),
                message,
              ],
            }
          : t,
      );
      emitChange();
    }

    return message;
  },

  async loadMessages(threadId: string): Promise<void> {
    const res = await apiClient.get<any>(`/chat/threads/${threadId}/messages`);
    if (!res?.items || !Array.isArray(res.items)) return;

    threads = threads.map((t) =>
      t.id === threadId
        ? {
            ...t,
            messages: res.items.map((m: any) => mapMessage(m, t)),
            lastMessageAt:
              res.items[res.items.length - 1]?.createdAt || t.lastMessageAt,
          }
        : t,
    );
    emitChange();
  },

  async syncWithBackend(): Promise<void> {
    try {
      const res = await apiClient.get<any>('/chat/threads');
      if (res?.items && Array.isArray(res.items)) {
        threads = res.items.map((item: any) => mapThread(item));
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

  clearLocalState(): void {
    threads = [];
    emitChange();
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
