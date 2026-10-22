import { useSyncExternalStore } from 'react';
import { UserRole } from '@weyro/api-contracts';
import { apiClient, setUnauthorizedCallback } from './api-client';
import { tokenStorage, UserSessionProfile } from './token-storage';

export interface AuthUser extends UserSessionProfile {
  token?: string;
  refreshToken?: string;
}

export type ProviderTypeOption =
  | 'MECHANIC'
  | 'GARAGE'
  | 'AUTHORIZED_CENTER'
  | 'PARTS_DEALER'
  | 'TOWING'
  | 'ROADSIDE';

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
}

let currentUser: AuthUser | null = null;
let isAuthLoading = false;
let isInitialized = false;

type Listener = () => void;
let listeners: Listener[] = [];

let currentSnapshot: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
};

function emitChange() {
  currentSnapshot = {
    user: currentUser,
    isAuthenticated: Boolean(currentUser?.id),
    isLoading: isAuthLoading,
    isInitialized,
  };
  for (const listener of listeners) {
    listener();
  }
}

async function initAuth(): Promise<void> {
  try {
    const [token, session] = await Promise.all([
      tokenStorage.getAccessToken(),
      tokenStorage.getUserSession(),
    ]);

    if (token && session?.id) {
      currentUser = {
        ...session,
        token,
      };
    } else {
      currentUser = null;
    }
  } catch {
    currentUser = null;
  } finally {
    isInitialized = true;
    emitChange();
  }
}

// Automatically initialize auth state on module load
initAuth().catch(() => {});

// Listen for 401 refresh failures from apiClient
setUnauthorizedCallback(() => {
  currentUser = null;
  emitChange();
});

export const authStore = {
  getSnapshot(): AuthState {
    return currentSnapshot;
  },

  getUser(): AuthUser | null {
    return currentUser;
  },

  async login(params: {
    emailOrPhone: string;
    password: string;
  }): Promise<AuthUser> {
    isAuthLoading = true;
    emitChange();

    try {
      const data = await apiClient.post<any>(
        '/auth/login',
        {
          emailOrPhone: params.emailOrPhone.trim(),
          password: params.password,
        },
        { skipAuth: true },
      );

      const name = data.user?.customerProfile?.firstName
        ? `${data.user.customerProfile.firstName} ${data.user.customerProfile.lastName || ''}`.trim()
        : data.user?.providerProfile?.businessName || data.user?.email || 'User';

      const userProfile: UserSessionProfile = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        role: data.user.role as UserRole,
        name,
        customerProfileId: data.user?.customerProfile?.id,
        providerProfileId: data.user?.providerProfile?.id,
      };

      await Promise.all([
        tokenStorage.setAccessToken(data.accessToken),
        tokenStorage.setRefreshToken(data.refreshToken),
        tokenStorage.setUserSession(userProfile),
      ]);

      currentUser = {
        ...userProfile,
        token: data.accessToken,
        refreshToken: data.refreshToken,
      };

      return currentUser;
    } finally {
      isAuthLoading = false;
      emitChange();
    }
  },

  async register(params: {
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    name: string;
    businessName?: string;
    providerType?: ProviderTypeOption;
    latitude?: number;
    longitude?: number;
    towingVehicleTypes?: ('FLATBED' | 'HOOK_AND_CHAIN' | 'MOTORCYCLE' | 'ANY')[];
    maxVehicleWeightKg?: number;
    towingBaseFee?: number;
    towingPerKmFee?: number;
  }): Promise<AuthUser> {
    isAuthLoading = true;
    emitChange();

    try {
      const parts = params.name.trim().split(' ');
      const firstName = parts[0] || 'User';
      const lastName = parts.slice(1).join(' ') || 'Member';

      const data = await apiClient.post<any>(
        '/auth/register',
        {
          email: params.email.trim(),
          phone: params.phone.trim(),
          password: params.password,
          role: params.role,
          firstName,
          lastName,
          businessName: params.businessName?.trim(),
          providerType: params.providerType,
          latitude: params.latitude,
          longitude: params.longitude,
          address: params.businessName?.trim() || params.name.trim(),
          towingVehicleTypes: params.towingVehicleTypes,
          maxVehicleWeightKg: params.maxVehicleWeightKg,
          towingBaseFee: params.towingBaseFee,
          towingPerKmFee: params.towingPerKmFee,
        },
        { skipAuth: true },
      );

      const userProfile: UserSessionProfile = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        role: data.user.role as UserRole,
        name: params.name.trim(),
        customerProfileId: data.user?.customerProfile?.id,
        providerProfileId: data.user?.providerProfile?.id,
      };

      await Promise.all([
        tokenStorage.setAccessToken(data.accessToken),
        tokenStorage.setRefreshToken(data.refreshToken),
        tokenStorage.setUserSession(userProfile),
      ]);

      currentUser = {
        ...userProfile,
        token: data.accessToken,
        refreshToken: data.refreshToken,
      };

      return currentUser;
    } finally {
      isAuthLoading = false;
      emitChange();
    }
  },

  async logout(): Promise<void> {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      apiClient
        .post('/auth/logout', { refreshToken })
        .catch(() => {});
    }

    await tokenStorage.clearAll();
    currentUser = null;
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
