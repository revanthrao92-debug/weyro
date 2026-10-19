import { useSyncExternalStore } from 'react';
import { weyroNotifications } from './notifications';

export interface ChatMessage {
  id: string;
  threadId: string;
  senderRole: 'CUSTOMER' | 'PROVIDER';
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

// Seed chat conversations matching the BMW 330i damage request
let threads: ChatThread[] = [
  {
    id: 'req_seed_01_Apex OEM Auto Dismantlers',
    requestId: 'req_seed_01',
    providerName: 'Apex OEM Auto Dismantlers',
    customerName: 'Marcus Vance',
    damagedPart: 'Front Bumper & Headlight Assembly',
    vehicle: '2022 BMW 330i M-Sport',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    messages: [
      {
        id: 'msg_01',
        threadId: 'req_seed_01_Apex OEM Auto Dismantlers',
        senderRole: 'PROVIDER',
        senderName: 'Apex OEM Auto Dismantlers',
        text: 'Hello Marcus! We inspected your uploaded damage photo. We have an exact matching OEM LED matrix headlight assembly in stock.',
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      },
      {
        id: 'msg_02',
        threadId: 'req_seed_01_Apex OEM Auto Dismantlers',
        senderRole: 'CUSTOMER',
        senderName: 'Marcus Vance',
        text: 'Thanks! Does the unit include the ballast and control module, or is it just the bare housing?',
        timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      },
      {
        id: 'msg_03',
        threadId: 'req_seed_01_Apex OEM Auto Dismantlers',
        senderRole: 'PROVIDER',
        senderName: 'Apex OEM Auto Dismantlers',
        text: 'It is the complete plug-and-play assembly including the OEM LED ballast and all mounting tabs intact. No coding required.',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
    ],
  },
];

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
    senderRole: 'CUSTOMER' | 'PROVIDER',
    senderName: string,
    text: string
  ): ChatMessage | null {
    const threadIndex = threads.findIndex((t) => t.id === threadId);
    if (threadIndex === -1) return null;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      threadId,
      senderRole,
      senderName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const targetThread = threads[threadIndex];
    const updatedThread: ChatThread = {
      ...targetThread,
      messages: [...targetThread.messages, newMsg],
      lastMessageAt: newMsg.timestamp,
    };

    threads = [
      ...threads.slice(0, threadIndex),
      updatedThread,
      ...threads.slice(threadIndex + 1),
    ];

    emitChange();
    weyroNotifications.chatMessageReceived(senderName, text);
    return newMsg;
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
    chatStore.getThreads
  );
}

export function useChatThread(threadId: string): ChatThread | undefined {
  const all = useChatThreads();
  return all.find((t) => t.id === threadId);
}
