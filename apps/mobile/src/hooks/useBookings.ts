import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

import { notice } from '@/lib/confirm';

export type Booking = {
  /** Weyro reference number, e.g. J-261127-0042-6. */
  ref?: string;
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
  payments?: {
    id: string;
    status: string;
    amount: number;
    currency: string;
  }[];
  quotation?: {
    id: string;
    totalCost: number;
    deliveryMethod?: string | null;
    etaDescription: string;
    warrantyDays: number;
    notes: string | null;
    request?: {
      ref?: string;
      id: string;
      title: string;
      category: string;
      address: string;
      latitude: number;
      longitude: number;
      dropoffAddress?: string | null;
      towingVehicleType?: string | null;
      towingDistanceKm?: number | null;
      vehicleWeightKg?: number | null;
      roadsideKind?: string | null;
      vehicle?: {
        make: string;
        model: string;
        year: number | null;
        registrationNumber?: string | null;
      } | null;
    } | null;
  } | null;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    phone?: string | null;
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
    verificationStatus?: string;
  };
};

export function useBookings(status?: string, opts?: { active?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ['bookings', status, opts?.active ?? false, opts?.limit ?? null],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      // active: every job still moving, however old (the default page is the newest 20).
      if (opts?.active) qs.set('active', 'true');
      if (opts?.limit) qs.set('limit', String(opts.limit));
      const query = qs.toString();
      return apiClient<{ items: Booking[]; nextCursor?: string }>(query ? `/bookings?${query}` : '/bookings');
    },
  });
}

export function useBooking(id: string, live = false) {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: async () => apiClient<Booking>(`/bookings/${id}`),
    enabled: !!id,
    // Live-ish status while the job is moving and the screen is in front.
    refetchInterval: (query) =>
      live && ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(query.state.data?.status ?? '')
        ? 15_000
        : false,
  });
}

export function useUpdateBookingLocation() {
  return useMutation({
    mutationFn: async ({
      id,
      latitude,
      longitude,
      etaMinutes,
    }: {
      id: string;
      latitude: number;
      longitude: number;
      etaMinutes?: number;
    }) => {
      return apiClient(`/bookings/${id}/location`, {
        method: 'PATCH',
        body: JSON.stringify({ latitude, longitude, etaMinutes }),
      });
    },
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
      completionNotes,
    }: {
      id: string;
      status: string;
      trackingNumber?: string;
      carrierName?: string;
      completionNotes?: string;
    }) => {
      return apiClient(`/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          trackingNumber,
          carrierName,
          completionNotes,
        }),
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
      notice('Update failed', (err as Error).message);
    },
    // Returned so the step button stays busy until the lists show the new step
    // (a fast second tap would otherwise send the same step again and fail).
    onSettled: (_data, _error, variables) => {
      const id = (variables as { id: string }).id;
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['booking', id] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['providerDashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['adminBookings'] }),
        queryClient.invalidateQueries({ queryKey: ['adminOverview'] }),
      ]);
    },
  });
}
