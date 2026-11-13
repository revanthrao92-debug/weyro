/* global jest, describe, it, expect, beforeEach */
import {
  clearOfflineQueue,
  enqueueMutation,
  flushOfflineQueue,
  listQueuedMutations,
} from '../src/services/offline-queue';
import { apiClient, ApiError } from '../src/services/api-client';

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
});
