import { z } from 'zod';
import { tokenStorage } from './token-storage';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: any,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions<T> {
  schema?: z.ZodType<T>;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

let onUnauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedCallback(callback: () => void) {
  onUnauthorizedCallback = callback;
}

async function executeRequest<T>(
  method: HttpMethod,
  endpoint: string,
  body?: any,
  options?: RequestOptions<T>,
  isRetry: boolean = false,
): Promise<T> {
  let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  if (options?.params) {
    const query = new URLSearchParams();
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    const qs = query.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  if (!options?.skipAuth) {
    const token = await tokenStorage.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Handle 401 Unauthorized with token refresh
  if (res.status === 401 && !isRetry && !options?.skipAuth) {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      await tokenStorage.clearAll();
      if (onUnauthorizedCallback) onUnauthorizedCallback();
      throw new ApiClientError(401, 'Unauthorized: session expired');
    }

    if (isRefreshing) {
      // Wait for concurrent refresh
      return new Promise<T>((resolve, reject) => {
        addRefreshSubscriber(async (newToken) => {
          if (!newToken) {
            return reject(new ApiClientError(401, 'Session refresh failed'));
          }
          try {
            const retryRes = await executeRequest<T>(
              method,
              endpoint,
              body,
              options,
              true,
            );
            resolve(retryRes);
          } catch (err) {
            reject(err);
          }
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshRes.ok) {
        throw new Error('Refresh token invalid');
      }

      const refreshData = await refreshRes.json();
      await tokenStorage.setAccessToken(refreshData.accessToken);
      if (refreshData.refreshToken) {
        await tokenStorage.setRefreshToken(refreshData.refreshToken);
      }

      onRefreshed(refreshData.accessToken);
      isRefreshing = false;

      // Retry original request
      return executeRequest<T>(method, endpoint, body, options, true);
    } catch {
      isRefreshing = false;
      onRefreshed(null);
      await tokenStorage.clearAll();
      if (onUnauthorizedCallback) onUnauthorizedCallback();
      throw new ApiClientError(401, 'Session expired. Please sign in again.');
    }
  }

  // Parse JSON response
  let json: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      json = await res.json();
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const message =
      json?.message ||
      (Array.isArray(json?.errors) ? json.errors.join(', ') : 'Request failed');
    throw new ApiClientError(res.status, message, json);
  }

  // If Zod schema provided, validate response payload
  if (options?.schema && json !== null) {
    try {
      return options.schema.parse(json);
    } catch (zodErr: any) {
      throw new ApiClientError(
        500,
        `Contract validation failed: ${zodErr.message}`,
        zodErr,
      );
    }
  }

  return json as T;
}

export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions<T>): Promise<T> {
    return executeRequest<T>('GET', endpoint, undefined, options);
  },

  post<T>(endpoint: string, body?: any, options?: RequestOptions<T>): Promise<T> {
    return executeRequest<T>('POST', endpoint, body, options);
  },

  patch<T>(endpoint: string, body?: any, options?: RequestOptions<T>): Promise<T> {
    return executeRequest<T>('PATCH', endpoint, body, options);
  },

  put<T>(endpoint: string, body?: any, options?: RequestOptions<T>): Promise<T> {
    return executeRequest<T>('PUT', endpoint, body, options);
  },

  delete<T>(endpoint: string, options?: RequestOptions<T>): Promise<T> {
    return executeRequest<T>('DELETE', endpoint, undefined, options);
  },
};
