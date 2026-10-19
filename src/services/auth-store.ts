import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from '@weyro/api-contracts';

export interface AuthUser {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  name: string;
  token?: string;
  refreshToken?: string;
}

export interface AuthState {
  user: AuthUser;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AUTH_STORAGE_KEY = '@weyro/auth_session_v1';
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const INITIAL_USER: AuthUser = {
  id: '',
  email: '',
  phone: '',
  role: 'CUSTOMER',
  name: 'Guest',
  token: undefined,
};

let currentUser: AuthUser = INITIAL_USER;
let isAuthLoading = false;

type Listener = () => void;
let listeners: Listener[] = [];

let currentSnapshot: AuthState = {
  user: currentUser,
  isAuthenticated: false,
  isLoading: false,
};

function emitChange() {
  currentSnapshot = {
    user: currentUser,
    isAuthenticated: Boolean(currentUser?.token),
    isLoading: isAuthLoading,
  };
  for (const listener of listeners) {
    listener();
  }
}

async function initAuth(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.id && parsed?.token) {
        currentUser = parsed;
        emitChange();
      }
    }
  } catch {
    // Stored session corrupted or unavailable
  }
}

initAuth().catch(() => {});

function persistSession(user: AuthUser | null): void {
  if (user && user.token) {
    AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user)).catch(() => {});
  } else {
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
  }
}

export const authStore = {
  getSnapshot(): AuthState {
    return currentSnapshot;
  },

  getUser(): AuthUser {
    return currentUser;
  },

  async login(params: { emailOrPhone: string; password?: string }): Promise<AuthUser> {
    isAuthLoading = true;
    emitChange();

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrPhone: params.emailOrPhone,
          password: params.password || 'WeyroDev@2026',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid credentials');
      }

      const name = data.user?.customerProfile?.firstName
        ? `${data.user.customerProfile.firstName} ${data.user.customerProfile.lastName || ''}`.trim()
        : data.user?.providerProfile?.businessName || data.user?.email || 'User';

      currentUser = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        role: data.user.role as UserRole,
        name,
        token: data.accessToken,
        refreshToken: data.refreshToken,
      };

      persistSession(currentUser);
      return currentUser;
    } finally {
      isAuthLoading = false;
      emitChange();
    }
  },

  async register(params: {
    email: string;
    phone: string;
    password?: string;
    role: UserRole;
    name: string;
    businessName?: string;
  }): Promise<AuthUser> {
    isAuthLoading = true;
    emitChange();

    try {
      const parts = params.name.trim().split(' ');
      const firstName = parts[0] || 'User';
      const lastName = parts.slice(1).join(' ') || 'Member';

      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          phone: params.phone,
          password: params.password || 'WeyroDev@2026',
          role: params.role,
          firstName,
          lastName,
          businessName: params.businessName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      currentUser = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        role: data.user.role as UserRole,
        name: params.name,
        token: data.accessToken,
        refreshToken: data.refreshToken,
      };

      persistSession(currentUser);
      return currentUser;
    } finally {
      isAuthLoading = false;
      emitChange();
    }
  },

  logout(): void {
    if (currentUser?.token) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ refreshToken: currentUser.refreshToken }),
      }).catch(() => {});
    }

    currentUser = INITIAL_USER;
    persistSession(null);
    emitChange();
  },

  subscribe(listener: Listener): () => void {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

export function useAuth(): AuthState {
  return useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getSnapshot,
  );
}
