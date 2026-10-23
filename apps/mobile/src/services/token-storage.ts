import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'weyro_access_token';
const REFRESH_TOKEN_KEY = 'weyro_refresh_token';

async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Non-blocking: secure store may not be available on all platforms
  }
}

async function safeDeleteItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Non-blocking: secure store may not be available on all platforms
  }
}

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return safeGetItem(TOKEN_KEY);
  },

  async setAccessToken(token: string): Promise<void> {
    await safeSetItem(TOKEN_KEY, token);
  },

  async deleteAccessToken(): Promise<void> {
    await safeDeleteItem(TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return safeGetItem(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await safeSetItem(REFRESH_TOKEN_KEY, token);
  },

  async deleteRefreshToken(): Promise<void> {
    await safeDeleteItem(REFRESH_TOKEN_KEY);
  },

  async clearAll(): Promise<void> {
    await safeDeleteItem(TOKEN_KEY);
    await safeDeleteItem(REFRESH_TOKEN_KEY);
  },
};

export function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url');
}
