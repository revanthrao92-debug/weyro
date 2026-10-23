import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { Alert } from 'react-native';

export type CustomerProfile = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  savedAddresses?: SavedAddress[];
};

export type SavedAddress = {
  id?: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type Vehicle = {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  registrationNumber: string;
  vinNumber?: string | null;
  fuelType: string;
  color?: string | null;
  createdAt: string;
};

export type ProviderProfile = {
  id: string;
  userId: string;
  businessName: string;
  providerType: string;
  description: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  verificationStatus: string;
  verificationDocuments?: Record<string, string> | null;
  avgRating: number;
  totalReviews: number;
  completedJobs: number;
  isAvailable: boolean;
  badge?: string | null;
  towingVehicleTypes?: string[];
  maxVehicleWeightKg?: number | null;
  towingBaseFee?: number | null;
  towingPerKmFee?: number | null;
  email?: string;
  accountPhone?: string;
  isActive?: boolean;
  counts?: {
    quotations: number;
    bookings: number;
    reviews: number;
    listings: number;
  };
};

export function useCustomerProfile() {
  return useQuery({
    queryKey: ['customerProfile'],
    queryFn: async () => apiClient<CustomerProfile>('/customers/me'),
  });
}

export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
    }) => {
      return apiClient<CustomerProfile>('/customers/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerProfile'] });
    },
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => apiClient<{ addresses: SavedAddress[] }>('/customers/me/addresses'),
  });
}

export function useReplaceAddresses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (addresses: SavedAddress[]) => {
      return apiClient<{ addresses: SavedAddress[] }>('/customers/me/addresses', {
        method: 'PUT',
        body: JSON.stringify({ addresses }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      queryClient.invalidateQueries({ queryKey: ['customerProfile'] });
    },
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => apiClient<{ items: Vehicle[] }>('/customers/me/vehicles'),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      make: string;
      model: string;
      year: number;
      registrationNumber: string;
      vinNumber?: string;
      fuelType?: string;
      color?: string;
    }) => {
      return apiClient<Vehicle>('/customers/me/vehicles', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Vehicle>) => {
      return apiClient<Vehicle>(`/customers/me/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/customers/me/vehicles/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useProviderProfile() {
  return useQuery({
    queryKey: ['providerProfile'],
    queryFn: async () => apiClient<ProviderProfile>('/providers/me'),
  });
}

export function useUpdateProviderProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      businessName?: string;
      description?: string;
      phone?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      serviceRadiusKm?: number;
      isAvailable?: boolean;
      towingVehicleTypes?: string[];
      maxVehicleWeightKg?: number | null;
      towingBaseFee?: number | null;
      towingPerKmFee?: number | null;
    }) => {
      return apiClient<ProviderProfile>('/providers/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providerProfile'] });
    },
  });
}

export function usePublicProvider(id: string) {
  return useQuery({
    queryKey: ['publicProvider', id],
    queryFn: async () => apiClient<ProviderProfile>(`/providers/${id}`),
    enabled: !!id,
  });
}

export function useProviderReviews(id: string) {
  return useQuery({
    queryKey: ['providerReviews', id],
    queryFn: async () =>
      apiClient<{ items: Array<{ id: string; rating: number; comment?: string; createdAt: string; customerName: string }>; nextCursor?: string | null }>(
        `/providers/${id}/reviews`
      ),
    enabled: !!id,
  });
}
