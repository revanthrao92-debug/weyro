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
}

export interface AuthState {
  user: AuthUser;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AUTH_STORAGE_KEY = '@weyro/auth_session_v1';
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const DEFAULT_USERS: Record<UserRole, AuthUser> = {
  CUSTOMER: {
    id: 'usr_cust_01',
    email: 'marcus.vance@example.com',
    phone: '+1 (555) 234-5678',
    role: 'CUSTOMER',
    name: 'Marcus Vance',
    token: 'jwt_demo_customer_token',
  },
  PROVIDER: {
    id: 'usr_prov_01',
    email: 'contact@apexoemparts.com',
    phone: '+1 (555) 876-5432',
    role: 'PROVIDER',
    name: 'Apex OEM Dismantlers',
    token: 'jwt_demo_provider_token',
  },
  ADMIN: {
    id: 'usr_admin_01',
    email: 'ops@weyro.com',
    phone: '+1 (555) 999-0000',
    role: 'ADMIN',
    name: 'Platform Auditor',
    token: 'weyro_admin_super_secret_token',
  },
  BOTH: {
    id: 'usr_both_01',
    email: 'dual@weyro.com',
    phone: '+1 (555) 444-1212',
    role: 'BOTH',
    name: 'Dual Operator',
    token: 'jwt_demo_both_token',
  },
};

let currentUser: AuthUser = DEFAULT_USERS.CUSTOMER;
let isAuthLoading = false;

type Listener = () => void;
let listeners: Listener[] = [];

let currentSnapshot: AuthState = {
  user: currentUser,
  isAuthenticated: true,
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
      if (parsed?.id && parsed?.role) {
        currentUser = parsed;
        emitChange();
      }
    }
  } catch {
    // Non-blocking fallback
  }
}

initAuth().catch(() => {});

function persistSession(user: AuthUser): void {
  AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user)).catch(() => {});
}

export const authStore = {
  getSnapshot(): AuthState {
    return currentSnapshot;
  },

  getUser(): AuthUser {
    return currentUser;
  },

  switchRole(role: UserRole): void {
    currentUser = DEFAULT_USERS[role] || DEFAULT_USERS.CUSTOMER;
    persistSession(currentUser);
    emitChange();
  },

  async login(email: string): Promise<AuthUser> {
    isAuthLoading = true;
    emitChange();

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json();
        currentUser = {
          id: data.user?.id || `usr_${Date.now()}`,
          email: data.user?.email || email,
          phone: data.user?.phone || '+1 555-0100',
          role: (data.user?.role as UserRole) || 'CUSTOMER',
          name: data.user?.customerProfile?.firstName
            ? `${data.user.customerProfile.firstName} ${data.user.customerProfile.lastName || ''}`.trim()
            : 'Weyro Member',
          token: data.accessToken,
        };
      } else {
        // Fallback for offline dev
        currentUser = {
          id: `usr_${Date.now()}`,
          email,
          phone: '+1 (555) 012-3456',
          role: 'CUSTOMER',
          name: email.split('@')[0],
          token: `jwt_local_${Date.now()}`,
        };
      }
    } catch {
      currentUser = {
        id: `usr_${Date.now()}`,
        email,
        phone: '+1 (555) 012-3456',
        role: 'CUSTOMER',
        name: email.split('@')[0],
        token: `jwt_local_${Date.now()}`,
      };
    } finally {
      isAuthLoading = false;
      persistSession(currentUser);
      emitChange();
    }

    return currentUser;
  },

  async register(params: {
    email: string;
    phone: string;
    role: UserRole;
    name: string;
    businessName?: string;
  }): Promise<AuthUser> {
    isAuthLoading = true;
    emitChange();

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          phone: params.phone,
          role: params.role,
          firstName: params.name.split(' ')[0],
          lastName: params.name.split(' ').slice(1).join(' '),
          businessName: params.businessName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        currentUser = {
          id: data.user?.id || `usr_${Date.now()}`,
          email: data.user?.email || params.email,
          phone: data.user?.phone || params.phone,
          role: params.role,
          name: params.name,
          token: data.accessToken,
        };
      } else {
        currentUser = {
          id: `usr_${Date.now()}`,
          email: params.email,
          phone: params.phone,
          role: params.role,
          name: params.name,
          token: `jwt_reg_${Date.now()}`,
        };
      }
    } catch {
      currentUser = {
        id: `usr_${Date.now()}`,
        email: params.email,
        phone: params.phone,
        role: params.role,
        name: params.name,
        token: `jwt_reg_${Date.now()}`,
      };
    } finally {
      isAuthLoading = false;
      persistSession(currentUser);
      emitChange();
    }

    return currentUser;
  },

  logout(): void {
    currentUser = {
      id: '',
      email: '',
      phone: '',
      role: 'CUSTOMER',
      name: 'Guest',
      token: undefined,
    };
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
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
    authStore.getSnapshot
  );
}
