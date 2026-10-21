import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { API_BASE_URL } from './api-client';
import { tokenStorage } from './token-storage';

const QUEUE_STORAGE_KEY = '@weyro/offline_mutations_v2';
const MAX_RETRIES = 5;

export interface QueuedMutation {
  id: string; // Idempotency key
  type: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body: any;
  createdAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
}

export interface OfflineSyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  hasErrors: boolean;
}

let queue: QueuedMutation[] = [];
let isSyncing = false;
let lastSyncAt: string | null = null;
let hasErrors = false;

type Listener = () => void;
let listeners: Listener[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

async function loadQueueFromStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) {
      queue = JSON.parse(raw);
      emitChange();
    }
  } catch {
    queue = [];
  }
}

async function persistQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Non-blocking storage error
  }
}

loadQueueFromStorage().then(() => {
  if (queue.length > 0) {
    offlineQueue.flush().catch(() => {});
  }
});

export const offlineQueue = {
  getSnapshot(): OfflineSyncStatus {
    return {
      isSyncing,
      pendingCount: queue.length,
      lastSyncAt,
      hasErrors,
    };
  },

  getQueue(): QueuedMutation[] {
    return [...queue];
  },

  async enqueue(
    type: string,
    endpoint: string,
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body: any,
  ): Promise<QueuedMutation> {
    const mutation: QueuedMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      endpoint,
      method,
      body,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    queue = [...queue, mutation];
    await persistQueue();
    emitChange();

    // Trigger flush asynchronously
    this.flush().catch(() => {});

    return mutation;
  },

  async flush(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (isSyncing || queue.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    isSyncing = true;
    hasErrors = false;
    emitChange();

    let succeeded = 0;
    let failed = 0;
    const remainingQueue: QueuedMutation[] = [];

    try {
      const now = Date.now();

      for (const item of queue) {
        // Exponential backoff check: wait 2^retryCount * 1000 ms before retrying
        if (item.retryCount > 0 && item.lastAttemptAt) {
          const backoffMs = Math.min(60000, Math.pow(2, item.retryCount) * 1000);
          const elapsed = now - new Date(item.lastAttemptAt).getTime();
          if (elapsed < backoffMs) {
            remainingQueue.push(item);
            continue;
          }
        }

        // Attach fresh JWT at send time (not queue time)
        const token = await tokenStorage.getAccessToken();
        const url = item.endpoint.startsWith('http')
          ? item.endpoint
          : `${API_BASE_URL}${item.endpoint}`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Idempotency-Key': item.id,
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        try {
          const res = await fetch(url, {
            method: item.method,
            headers,
            body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
          });

          if (res.ok) {
            succeeded++;
            // Item succeeded: dropped from remaining queue
          } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
            // Unrecoverable 4xx client error (400 Bad Request, 403 Forbidden, 404 Not Found, 409 Conflict)
            // Drop from queue to prevent infinite poison-pill retry loops
            failed++;
            hasErrors = true;
          } else {
            // 5xx Server Error or 429 Rate Limit - retry with exponential backoff
            failed++;
            hasErrors = true;
            if (item.retryCount + 1 < MAX_RETRIES) {
              remainingQueue.push({
                ...item,
                retryCount: item.retryCount + 1,
                lastAttemptAt: new Date().toISOString(),
                lastError: `HTTP ${res.status}`,
              });
            }
          }
        } catch (networkErr: any) {
          // Network failure / offline - retry later
          failed++;
          if (item.retryCount + 1 < MAX_RETRIES) {
            remainingQueue.push({
              ...item,
              retryCount: item.retryCount + 1,
              lastAttemptAt: new Date().toISOString(),
              lastError: networkErr?.message || 'Network error',
            });
          }
        }
      }

      queue = remainingQueue;
      lastSyncAt = new Date().toISOString();
      await persistQueue();
    } finally {
      isSyncing = false;
      emitChange();
    }

    return { processed: succeeded + failed, succeeded, failed };
  },

  async clear(): Promise<void> {
    queue = [];
    hasErrors = false;
    await persistQueue();
    emitChange();
  },

  subscribe(listener: Listener): () => void {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

export function useOfflineQueue(): OfflineSyncStatus {
  return useSyncExternalStore(
    offlineQueue.subscribe,
    offlineQueue.getSnapshot,
    offlineQueue.getSnapshot,
  );
}
