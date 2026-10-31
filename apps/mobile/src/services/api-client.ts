import { tokenStorage } from './token-storage';

/**
 * Resolve the API base URL.
 *
 * H5 fix: there is no silent localhost fallback in release builds. In
 * production a missing env var is a hard startup error — the app cannot
 * function against localhost on a real device, and failing loudly (in
 * dev, via console) plus deterministically in release is safer than
 * requests that "mysteriously" hit 127.0.0.1 on the phone itself.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  if (__DEV__) {
    // Web/desktop Expo dev convenience only. On iOS devices localhost
    // refers to the device itself and cannot reach a backend on the Mac;
    // use the tunnel URL env var when testing on device.
    return 'http://localhost:4000/api/v1';
  }
  throw new Error(
    'EXPO_PUBLIC_API_URL is not configured. Set it in .env / EAS config before building for release.',
  );
}

export const API_URL = resolveApiUrl();

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * H6: single-flight token refresh.
 *
 * The refresh session is a shared promise: multiple 401 responses
 * concurrently trigger exactly one `/auth/refresh` call. Everyone awaits
 * the same in-flight result (or the same failure).
 */
export type TokenRefresher = () => Promise<string | null>;
export type SessionExpiredHandler = () => Promise<void> | void;

let tokenRefresher: TokenRefresher | null = null;
let sessionExpiredHandler: SessionExpiredHandler | null = null;
let refreshInFlight: Promise<string | null> | null = null;

/** Registered by the AuthProvider (which owns Supabase/token storage). */
export function setTokenRefresher(fn: TokenRefresher | null) {
  tokenRefresher = fn;
}

/** Registered by the AuthProvider to force a clean logout after failed refresh. */
export function setSessionExpiredHandler(fn: SessionExpiredHandler | null) {
  sessionExpiredHandler = fn;
}

/**
 * Kick off (or join) the single in-flight refresh. Resolves the NEW access
 * token, or null when refresh is not possible / fails.
 */
export async function refreshTokenSingleFlight(): Promise<string | null> {
  if (!accessToken && !(await tokenStorage.getAccessToken()) && !tokenStorage.getRefreshToken) {
    // Defensive: no tokens at all — refresh cannot help.
    return null;
  }
  if (!tokenRefresher) {
    return null;
  }
  if (!refreshInFlight) {
    refreshInFlight = tokenRefresher()
      .catch((err) => {
        // Refresh failed → the session is unrecoverable. Surface once.
        void sessionExpiredHandler?.();
        return null as string | null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const RETRY_EXEMPT_PATHS = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/send-otp', '/auth/verify-otp'];

export async function apiClient<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  isRetry = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  const currentToken = accessToken ?? (await tokenStorage.getAccessToken());
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
    setAccessToken(currentToken);
  }

  const rawPath = input.toString().startsWith('http')
    ? new URL(input.toString()).pathname + new URL(input.toString()).search
    : input.toString();
  const url = input.toString().startsWith('http')
    ? input.toString()
    : `${API_URL}${input.toString()}`;

  const response = await fetch(url, {
    ...init,
    headers,
  });

  // H6: on 401 (except exempt auth endpoints), refresh once and retry once.
  if (
    response.status === 401 &&
    !isRetry &&
    !RETRY_EXEMPT_PATHS.some((p) => rawPath.includes(p))
  ) {
    const refreshed = await refreshTokenSingleFlight();
    if (refreshed) {
      return apiClient<T>(input, init, true);
    }
    // fallthrough: the expired-session handler fired; surface 401 to the caller
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorBody.message || errorBody.error || `Request failed with status ${response.status}`,
      errorBody
    );
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json();
}
