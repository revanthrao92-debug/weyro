import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { Platform as RNPlatform } from 'react-native';
import { apiClient, setAccessToken } from '@/services/api-client';
import { tokenStorage } from '@/services/token-storage';
import {
  UserRole,
  User,
  CustomerProfile,
  ProviderProfile,
} from '@weyro/api-contracts';

type AuthUser = User & {
  customerProfile?: CustomerProfile | null;
  providerProfile?: ProviderProfile | null;
};

interface AuthContextType {
  user: AuthUser | null;
  customerProfile: CustomerProfile | null;
  providerProfile: ProviderProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  verifyOtp: (phone: string, code: string, purpose?: string) => Promise<void>;
  resetPassword: (phone: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const customerProfile = (user as any)?.customerProfile ?? null;
  const providerProfile = (user as any)?.providerProfile ?? null;
  const role = user?.role ?? null;
  const isAuthenticated = !!user;

  async function bootstrapAuth() {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        return;
      }
      setAccessToken(token);
      const me = await apiClient<AuthUser>('/auth/me');
      setUser(me);

      // Auto-register push token if stored locally
      await registerStoredPushToken();
    } catch {
      // Token invalid or expired — clear and stay unauthenticated
      await tokenStorage.clearAll();
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function registerStoredPushToken() {
    try {
      const stored = await SecureStore.getItemAsync('weyro_push_token');
      if (!stored) return;

      const deviceOs = RNPlatform.OS === 'ios' ? 'ios' : 'android';
      await apiClient('/notifications/push-token', {
        method: 'POST',
        body: JSON.stringify({ token: stored, deviceOs }),
      }).catch(() => {
        // Non-blocking: token registration failure shouldn't block auth
      });
    } catch {
      // Non-blocking
    }
  }

  useEffect(() => {
    void (async () => {
      await bootstrapAuth();
    })();
  }, []);

  // Register push token after auth bootstraps
  useEffect(() => {
    if (user) {
      void registerStoredPushToken();
    }
  }, [user]);

  const login = useCallback(
    async (emailOrPhone: string, password: string) => {
      const res = await apiClient<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone, password }),
      });

      await tokenStorage.setAccessToken(res.accessToken);
      await tokenStorage.setRefreshToken(res.refreshToken);
      setAccessToken(res.accessToken);
      setUser(res.user);
    },
    []
  );

  const register = useCallback(
    async (data: RegisterData) => {
      const res = await apiClient<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      await tokenStorage.setAccessToken(res.accessToken);
      await tokenStorage.setRefreshToken(res.refreshToken);
      setAccessToken(res.accessToken);
      setUser(res.user);
    },
    []
  );

  const verifyOtp = useCallback(
    async (phone: string, code: string, purpose = 'login') => {
      const res = await apiClient<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
        isNewUser: boolean;
      }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, code, purpose }),
      });

      await tokenStorage.setAccessToken(res.accessToken);
      await tokenStorage.setRefreshToken(res.refreshToken);
      setAccessToken(res.accessToken);
      setUser(res.user);
    },
    []
  );

  const resetPassword = useCallback(
    async (phone: string, code: string, newPassword: string) => {
      await apiClient('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ phone, code, newPassword }),
      });
      Alert.alert(
        'Success',
        'Password reset. Please log in with your new password.'
      );
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (refreshToken) {
        await apiClient('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Ignore logout errors — always clear local state
    } finally {
      await tokenStorage.clearAll();
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const res = await apiClient<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    await tokenStorage.setAccessToken(res.accessToken);
    await tokenStorage.setRefreshToken(res.refreshToken);
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      customerProfile,
      providerProfile,
      role,
      isAuthenticated,
      isLoading,
      login,
      register,
      verifyOtp,
      resetPassword,
      logout,
      refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

interface RegisterData {
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  businessName?: string;
  providerType?: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}
