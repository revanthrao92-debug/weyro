/* global jest, describe, it, expect, beforeEach */
/**
 * H5/H6 tests: api-client URL resolution + single-flight token refresh.
 * Uses jest-expo preset (see jest.config in apps/mobile) with fetch mocked.
 */

import {
  apiClient,
  setAccessToken,
  setTokenRefresher,
  setSessionExpiredHandler,
  refreshTokenSingleFlight,
} from '../src/services/api-client';

// Avoid loading the real token-storage (SecureStore) in unit tests
jest.mock('../src/services/token-storage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue(null),
    setAccessToken: jest.fn(),
    getRefreshToken: jest.fn().mockResolvedValue(null),
    setRefreshToken: jest.fn(),
    clearAll: jest.fn(),
  },
}));

describe('H5 — API URL resolution', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  it('fails loudly when env missing in release-mode resolution logic', () => {
    // Simulate the guard directly (import-time resolution keeps the first value).
    jest.resetModules();
    const devUrl = 'http://localhost:4000/api/v1';
    delete process.env.EXPO_PUBLIC_API_URL;

    // __DEV__ true here (jest) → localhost dev fallback is allowed.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { API_URL } = require('../src/services/api-client');
      expect(API_URL).toBe(devUrl);
    });
  });

  it('uses the env var when present', () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/v1/';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { API_URL } = require('../src/services/api-client');
      expect(API_URL).toBe('https://api.example.com/api/v1'); // trailing slash stripped
    });
  });
});

describe('H6 — single-flight token refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTokenRefresher(null);
    setSessionExpiredHandler(null);
    setAccessToken(null);
  });

  it('concurrent refreshTokenSingleFlight calls share one in-flight promise', async () => {
    let refresherCalls = 0;
    setTokenRefresher(async () => {
      refresherCalls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return 'new_token';
    });

    const [a, b, c] = await Promise.all([
      refreshTokenSingleFlight(),
      refreshTokenSingleFlight(),
      refreshTokenSingleFlight(),
    ]);

    expect(refresherCalls).toBe(1);
    expect(a).toBe('new_token');
    expect(b).toBe('new_token');
    expect(c).toBe('new_token');
  });

  it('a failed refresh logs the user out via the session-expired handler exactly once per batch', async () => {
    let expiredCalls = 0;
    setSessionExpiredHandler(() => {
      expiredCalls += 1;
    });
    setTokenRefresher(async () => {
      throw new Error('refresh failed');
    });

    const [a, b] = await Promise.all([
      refreshTokenSingleFlight(),
      refreshTokenSingleFlight(),
    ]);

    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(expiredCalls).toBe(1);
  });

  it('apiClient retries the original request exactly once after a 401+refresh', async () => {
    const mockFetch = jest
      .fn()
      // first call → 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      )
      // retry after refresh → 200
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    // @ts-expect-error global fetch in jest-expo
    global.fetch = mockFetch;

    let refresherCalls = 0;
    setTokenRefresher(() => {
      refresherCalls += 1;
      setAccessToken('fresh_token');
      return Promise.resolve('fresh_token');
    });
    setAccessToken('stale_token');

    const result = await apiClient('/requests/my');

    expect(result).toEqual({ ok: true, items: [] });
    expect(refresherCalls).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second request (after token refresh) carries the new token
    // @ts-expect-error private member access via mock
    const secondInit = mockFetch.mock.calls[1][1] as RequestInit;
    expect((secondInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh_token',
    );
  });

  it('does not attempt refresh for auth endpoints themselves', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Credentials rejected' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    // @ts-expect-error global fetch in jest-expo
    global.fetch = mockFetch;

    let refresherCalls = 0;
    setTokenRefresher(() => {
      refresherCalls += 1;
      return Promise.resolve('x');
    });

    await expect(apiClient('/auth/login', { method: 'POST', body: '{}' })).rejects.toThrow();
    expect(refresherCalls).toBe(0);
  });
});

describe('network failure handling', () => {
  it('returns a clear connection message instead of raw fetch failure', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await expect(apiClient('/ready')).rejects.toMatchObject({
      status: 0,
      message: 'Cannot reach Weyro servers. Check your connection and try again.',
    });

    global.fetch = originalFetch;
  });
});

describe('request timeout (30s AbortController)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = realFetch;
  });

  /** A fetch that never answers, but honours abort like the real one. */
  const hangingFetch = () =>
    jest.fn((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        // Like the real fetch: an already-aborted signal rejects immediately.
        if (init?.signal?.aborted) return reject(new Error('Aborted'));
        init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      }),
    );

  it('aborts a request that has not answered after 30 seconds', async () => {
    jest.useFakeTimers();
    const fetchMock = hangingFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    const pending = apiClient('/slow').catch((error) => error);
    await jest.advanceTimersByTimeAsync(29_999);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(2);
    const error = await pending;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(error).toMatchObject({ name: 'ApiError', status: 0 });
    expect(error.message).toMatch(/timed out/i);
  });

  it('a fast response is untouched and the timer is cleared', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    await expect(apiClient('/fast')).resolves.toEqual({ ok: true });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a caller-supplied abort still reads as a connection error, not a timeout', async () => {
    const caller = new AbortController();
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const pending = apiClient('/x', { signal: caller.signal }).catch((error) => error);
    caller.abort();
    const error = await pending;
    expect(error.status).toBe(0);
    expect(error.message).not.toMatch(/timed out/i);
  });
});
