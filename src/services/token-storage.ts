import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'weyro_access_token_v1';
const REFRESH_TOKEN_KEY = 'weyro_refresh_token_v1';
const USER_SESSION_KEY = 'weyro_user_session_v1';

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    return SecureStore.getItemAsync(key);
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
}

async function secureSet(key: string, value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

async function secureDelete(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}

export interface UserSessionProfile {
  id: string;
  email: string;
  phone: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | 'BOTH';
  name: string;
  customerProfileId?: string;
  providerProfileId?: string;
}

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return secureGet(ACCESS_TOKEN_KEY);
  },

  async setAccessToken(token: string): Promise<void> {
    await secureSet(ACCESS_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return secureGet(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await secureSet(REFRESH_TOKEN_KEY, token);
  },

  async getUserSession(): Promise<UserSessionProfile | null> {
    const raw = await secureGet(USER_SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserSessionProfile;
    } catch {
      return null;
    }
  },

  async setUserSession(profile: UserSessionProfile): Promise<void> {
    await secureSet(USER_SESSION_KEY, JSON.stringify(profile));
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      secureDelete(ACCESS_TOKEN_KEY),
      secureDelete(REFRESH_TOKEN_KEY),
      secureDelete(USER_SESSION_KEY),
    ]);
  },
};
