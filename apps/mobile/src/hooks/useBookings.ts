import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { tokenStorage } from '@/services/token-storage';
import { Alert } from 'react-native';

export type Booking = {
  id: string;
  quotationId: string;
  customerId: string;
  providerId: string;
  status: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  completionNotes?: string;
  createdAt: string;
  payment?: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    method: string | null;
    paidAt: string | null;
    releasedAt: string | null;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  provider?: {
    id: string;
    businessName: string;
    providerType: string;
    description: string | null;
    serviceRadiusKm: number | null;
    avgRating: number;
    totalReviews: number;
    completedJobs: number;
    isAvailable: boolean;
    badge: string | null;
  };
};

export function useBookings(status?: string) {
  return useQuery({
    queryKey: ['bookings', status],
    queryFn: async () => {
      const url = status ? `/bookings?status=${status}` : '/bookings';
      return apiClient<{ items: Booking[]; nextCursor?: string }>(url);
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: async () => apiClient<Booking>(`/bookings/${id}`),
    enabled: !!id,
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      trackingNumber,
      carrierName,
    }: {
      id: string;
      status: string;
      trackingNumber?: string;
      carrierName?: string;
    }) => {
      return apiClient(`/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, trackingNumber, carrierName }),
      });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['booking', id] });
      const previous = queryClient.getQueryData<Booking>(['booking', id]);
      queryClient.setQueryData<Booking>(['booking', id], (old) =>
        old ? { ...old, status } : old
      );
      return { previous };
    },
    onError: (err, { id }, context) => {
      queryClient.setQueryData<Booking>(['booking', id], context?.previous);
      Alert.alert('Update failed', (err as Error).message);
    },
    onSettled: (_data, _error, variables) => {
      const id = (variables as { id: string }).id;
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
