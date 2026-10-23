import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'weyro_access_token';
const REFRESH_TOKEN_KEY = 'weyro_refresh_token';

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async deleteAccessToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async deleteRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  async clearAll(): Promise<void> {
    await this.deleteAccessToken();
    await this.deleteRefreshToken();
  },
};

export function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url');
}
