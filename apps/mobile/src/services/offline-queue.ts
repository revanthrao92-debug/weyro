import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { apiClient, ApiError } from './api-client';

/**
 * Durable mutation queue for non-financial writes.
 *
 * Only explicitly queueable mutations (currently request creation) are stored.
 * Payments and other money movements must never enter this queue: the caller
 * is responsible for that policy, and this module rejects payment endpoints.
 *
 * The queue holds no secrets (endpoints, request bodies, retry state), so it
 * lives in AsyncStorage. It used to be in SecureStore, which is meant for
 * credentials and has a small per-value size limit that a long queue could
 * silently exceed; `readRaw` migrates a leftover SecureStore copy once.
 */

const STORAGE_KEY = 'weyro_offline_mutation_queue_v1';
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const BLOCKED_PATH = /\/payments?|\/refunds?|\/checkout|\/settle/i;

export type QueuedMutationStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED'
  | 'REQUIRES_ATTENTION';

export type QueuedMutation = {
  id: string;
  idempotencyKey: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  status: QueuedMutationStatus;
  lastError?: string;
};

type Listener = (items: QueuedMutation[]) => void;

const listeners = new Set<Listener>();
let flushing = false;
let memoryCache: QueuedMutation[] | null = null;

function notify(items: QueuedMutation[]) {
  memoryCache = items;
  listeners.forEach((listener) => listener(items));
}

function randomId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readRaw(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage === 'undefined'
        ? null
        : localStorage.getItem(STORAGE_KEY);
    }
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored;
    return await migrateLegacySecureStoreQueue();
  } catch {
    return null;
  }
}

/** One-time move of a queue written by older app versions into AsyncStorage. */
async function migrateLegacySecureStoreQueue(): Promise<string | null> {
  try {
    const legacy = await SecureStore.getItemAsync(STORAGE_KEY);
    if (legacy === null) return null;
    await AsyncStorage.setItem(STORAGE_KEY, legacy);
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return legacy;
  } catch {
    return null;
  }
}

async function writeRaw(value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, value);
      }
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable — keep the in-memory copy so this session can retry.
  }
}

export async function listQueuedMutations(): Promise<QueuedMutation[]> {
  if (memoryCache) return memoryCache;
  const raw = await readRaw();
  if (!raw) {
    memoryCache = [];
    return memoryCache;
  }
  try {
    const parsed = JSON.parse(raw);
    memoryCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    memoryCache = [];
  }
  return memoryCache;
}

async function persist(items: QueuedMutation[]): Promise<void> {
  notify(items);
  await writeRaw(JSON.stringify(items));
}

export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  void listQueuedMutations().then(listener);
  return () => listeners.delete(listener);
}

export async function enqueueMutation(input: {
  endpoint: string;
  method: QueuedMutation['method'];
  body?: unknown;
  idempotencyKey?: string;
}): Promise<QueuedMutation> {
  if (BLOCKED_PATH.test(input.endpoint)) {
    throw new Error('Financial operations cannot be queued for offline retry.');
  }
  const items = await listQueuedMutations();
  const mutation: QueuedMutation = {
    id: randomId(),
    idempotencyKey: input.idempotencyKey ?? randomId(),
    endpoint: input.endpoint,
    method: input.method,
    body: input.body,
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
    status: 'PENDING',
  };
  await persist([...items, mutation]);
  return mutation;
}

export function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

function backoffIso(attempts: number): string {
  const delay = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1)),
  );
  return new Date(Date.now() + delay).toISOString();
}

/**
 * Attempt every due mutation once. Safe to call on mount, on foreground and
 * after enqueueing. Returns the number of mutations that synced.
 */
export async function flushOfflineQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let synced = 0;
  try {
    let items = await listQueuedMutations();
    const now = Date.now();

    for (const item of items) {
      if (new Date(item.nextAttemptAt).getTime() > now) continue;
      if (item.status === 'REQUIRES_ATTENTION') continue;

      items = items.map((entry) =>
        entry.id === item.id ? { ...entry, status: 'SYNCING' } : entry,
      );
      await persist(items);

      try {
        await apiClient(item.endpoint, {
          method: item.method,
          body: item.body === undefined ? undefined : JSON.stringify(item.body),
          headers: { 'Idempotency-Key': item.idempotencyKey },
        });
        items = items.filter((entry) => entry.id !== item.id);
        synced += 1;
        await persist(items);
      } catch (error) {
        const attempts = item.attempts + 1;
        const retryable =
          isNetworkFailure(error) ||
          (error instanceof ApiError && error.status >= 500);
        const conflict = error instanceof ApiError && error.status === 409;
        const status: QueuedMutationStatus =
          retryable && attempts < MAX_ATTEMPTS
            ? 'PENDING'
            : conflict || retryable
              ? 'REQUIRES_ATTENTION'
              : 'FAILED';

        items = items.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                attempts,
                status,
                nextAttemptAt: backoffIso(attempts),
                lastError:
                  error instanceof Error ? error.message : 'Sync failed',
              }
            : entry,
        );
        await persist(items);
      }
    }
  } finally {
    flushing = false;
  }
  return synced;
}

export async function clearOfflineQueue(): Promise<void> {
  memoryCache = [];
  notify([]);
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => undefined); // any legacy copy
  } catch {
    // Best effort — the in-memory queue is already empty.
  }
}
