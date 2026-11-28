import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'weyro_access_token';
const REFRESH_TOKEN_KEY = 'weyro_refresh_token';

// Browsers have no secure store, so the login lived only in memory and a refresh logged you out.
// sessionStorage keeps it for this tab only and is cleared when the tab closes.
const webStore = Platform.OS === 'web' ? globalThis.sessionStorage : undefined;

async function safeGetItem(key: string): Promise<string | null> {
  try {
    if (webStore) return webStore.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    if (webStore) return webStore.setItem(key, value);
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Non-blocking: secure store may not be available on all platforms
  }
}

async function safeDeleteItem(key: string): Promise<void> {
  try {
    if (webStore) return webStore.removeItem(key);
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
