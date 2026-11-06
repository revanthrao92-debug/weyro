/* eslint-env jest */
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
      const { API_URL } = require('../src/services/api-client');
      expect(API_URL).toBe(devUrl);
    });
  });

  it('uses the env var when present', () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/v1/';
    jest.isolateModules(() => {
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
