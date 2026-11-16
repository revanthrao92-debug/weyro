/* global jest, describe, it, expect, beforeEach */
import {
  clearOfflineQueue,
  enqueueMutation,
  flushOfflineQueue,
  listQueuedMutations,
} from '../src/services/offline-queue';
import { apiClient, ApiError } from '../src/services/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => void store.set(key, value)),
      removeItem: jest.fn(async (key: string) => void store.delete(key)),
    },
  };
});

jest.mock('../src/services/api-client', () => {
  const actual = jest.requireActual('../src/services/api-client');
  return { ...actual, apiClient: jest.fn() };
});

const mockedApi = apiClient as jest.MockedFunction<typeof apiClient>;

describe('offline mutation queue', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearOfflineQueue();
  });

  it('persists a non-financial mutation', async () => {
    const queued = await enqueueMutation({
      endpoint: '/damage-requests',
      method: 'POST',
      body: { title: 'Front bumper dent' },
    });

    expect(queued.status).toBe('PENDING');
    expect(queued.idempotencyKey).toBeTruthy();
    expect(await listQueuedMutations()).toHaveLength(1);
  });

  it('refuses to queue payment operations', async () => {
    await expect(
      enqueueMutation({ endpoint: '/payments/refund', method: 'POST' }),
    ).rejects.toThrow('Financial operations cannot be queued');
    expect(await listQueuedMutations()).toHaveLength(0);
  });

  it('removes a mutation after a successful sync', async () => {
    await enqueueMutation({
      endpoint: '/damage-requests',
      method: 'POST',
      body: { title: 'Front bumper dent' },
    });
    mockedApi.mockResolvedValue({ id: 'req-1' } as never);

    const synced = await flushOfflineQueue();

    expect(synced).toBe(1);
    expect(await listQueuedMutations()).toHaveLength(0);
    expect(mockedApi).toHaveBeenCalledWith(
      '/damage-requests',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      }),
    );
  });

  it('keeps a network failure pending with backoff', async () => {
    await enqueueMutation({
      endpoint: '/damage-requests',
      method: 'POST',
      body: { title: 'Front bumper dent' },
    });
    mockedApi.mockRejectedValue(
      new ApiError(0, 'Cannot reach Weyro servers.'),
    );

    await flushOfflineQueue();
    const [item] = await listQueuedMutations();

    expect(item.status).toBe('PENDING');
    expect(item.attempts).toBe(1);
    expect(new Date(item.nextAttemptAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('marks a 4xx client error as failed instead of retrying forever', async () => {
    await enqueueMutation({
      endpoint: '/damage-requests',
      method: 'POST',
      body: { title: 'Front bumper dent' },
    });
    mockedApi.mockRejectedValue(new ApiError(422, 'Invalid request'));

    await flushOfflineQueue();
    const [item] = await listQueuedMutations();

    expect(item.status).toBe('FAILED');
    expect(item.attempts).toBe(1);
  });

  describe('storage (AsyncStorage, not SecureStore)', () => {
    const KEY = 'weyro_offline_mutation_queue_v1';

    it('writes the queue to AsyncStorage and never to SecureStore', async () => {
      await clearOfflineQueue();
      (SecureStore.setItemAsync as jest.Mock).mockClear();

      await enqueueMutation({ endpoint: '/damage-requests', method: 'POST', body: { title: 'Dent' } });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, expect.stringContaining('/damage-requests'));
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('migrates a queue left in SecureStore by an older app version, once', async () => {
      jest.resetModules(); // fresh module registry => fresh in-memory mock stores
      const legacy = JSON.stringify([
        { id: 'q_old', idempotencyKey: 'k', endpoint: '/damage-requests', method: 'POST', body: {}, createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: new Date().toISOString(), status: 'PENDING' },
      ]);
      // Everything below comes from the SAME (fresh) registry as the queue module.
      const freshSecure = require('expo-secure-store');
      const freshAsync = require('@react-native-async-storage/async-storage').default;
      await freshSecure.setItemAsync(KEY, legacy);

      const fresh = require('../src/services/offline-queue');
      const items = await fresh.listQueuedMutations();

      expect(items.map((item: { id: string }) => item.id)).toEqual(['q_old']);
      expect(await freshAsync.getItem(KEY)).toBe(legacy); // moved
      expect(await freshSecure.getItemAsync(KEY)).toBeNull(); // and removed from SecureStore
    });
  });
});
