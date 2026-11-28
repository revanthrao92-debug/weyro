/**
 * Regression: after renewing the login pass, the next request must carry the
 * NEW pass. The real refresh saved it to storage only, so the api-client kept
 * sending the expired one and the user was logged out.
 */
jest.mock('@/services/token-storage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue('expired_token'),
    getRefreshToken: jest.fn().mockResolvedValue('refresh_1'),
    setAccessToken: jest.fn().mockResolvedValue(undefined),
    setRefreshToken: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/services/background-location', () => ({ stopJobLocationUpdates: jest.fn() }));
jest.mock('@/services/offline-queue', () => ({ clearOfflineQueue: jest.fn(), flushOfflineQueue: jest.fn() }));

// eslint-disable-next-line import/first
import { performTokenRefresh } from '../src/hooks/useAuth';
// eslint-disable-next-line import/first
import { apiClient, setAccessToken } from '../src/services/api-client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('login pass renewal', () => {
  it('the request after a refresh uses the new pass', async () => {
    setAccessToken('expired_token');
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(json({ accessToken: 'new_token', refreshToken: 'refresh_2', user: { id: 'u1' } }, 201))
      .mockResolvedValueOnce(json({ ok: true }));
    // @ts-expect-error global fetch in jest-expo
    global.fetch = fetchMock;

    await performTokenRefresh();
    await apiClient('/auth/me');

    const headers = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer new_token');
  });
});
