import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export type CustomerDriver = {
  id: string;
  name: string;
  description: string;
  rating: number;
  totalReviews: number;
  completedJobs: number;
  experienceYears: number;
  languages: string[];
  transmissions: string[];
  hourlyRate: number;
  dailyRate: number;
  distanceKm: number | null;
  quote: number;
  endAt: string;
};

export type CustomerDriverBooking = {
  id: string;
  status:
    | 'REQUESTED'
    | 'CONFIRMED'
    | 'DRIVER_EN_ROUTE'
    | 'ARRIVED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'EXPIRED'
    | 'DISPUTED';
  engagement: 'HOURLY' | 'DAILY';
  scheduleMode: 'ON_DEMAND' | 'SCHEDULED';
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  startAt: string;
  endAt: string;
  durationHours: number | null;
  durationDays: number | null;
  notes: string | null;
  transmission: string | null;
  totalAmount: number;
  canCancel: boolean;
  startCodeAvailable: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  driver: {
    id: string;
    name: string;
    rating: number;
    totalReviews: number;
    completedJobs: number;
    experienceYears: number;
    languages: string[];
    transmissions: string[];
  };
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    registrationNumber: string;
    transmission: string | null;
    fuelType: string;
  } | null;
};

export type AvailableDriversParams = {
  startAt: string;
  engagement: 'HOURLY' | 'DAILY';
  durationHours?: number;
  durationDays?: number;
  lat?: number;
  lng?: number;
  transmission?: 'MANUAL' | 'AUTOMATIC';
};

export function useAvailableDrivers(params: AvailableDriversParams | null) {
  return useQuery({
    queryKey: ['driverGoDrivers', params],
    enabled: Boolean(params),
    queryFn: async () => {
      const query = new URLSearchParams({
        startAt: params!.startAt,
        engagement: params!.engagement,
      });
      if (params!.durationHours !== undefined) {
        query.set('durationHours', String(params!.durationHours));
      }
      if (params!.durationDays !== undefined) {
        query.set('durationDays', String(params!.durationDays));
      }
      if (params!.lat !== undefined) query.set('lat', String(params!.lat));
      if (params!.lng !== undefined) query.set('lng', String(params!.lng));
      if (params!.transmission) {
        query.set('transmission', params!.transmission);
      }
      return apiClient<{ items: CustomerDriver[] }>(
        `/driver-go/drivers?${query.toString()}`,
      );
    },
  });
}

export type CreateCustomerDriverBooking = {
  driverId: string;
  vehicleId: string;
  engagement: 'HOURLY' | 'DAILY';
  scheduleMode: 'SCHEDULED' | 'ON_DEMAND';
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  startAt: string;
  durationHours?: number;
  durationDays?: number;
  notes?: string;
  transmission?: 'MANUAL' | 'AUTOMATIC';
};

export function useCreateDriverBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCustomerDriverBooking) =>
      apiClient<CustomerDriverBooking>('/driver-go/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myDriverBookings'] });
      queryClient.invalidateQueries({ queryKey: ['driverGoDrivers'] });
    },
  });
}

export function useMyDriverBookings() {
  return useQuery({
    queryKey: ['myDriverBookings'],
    queryFn: async () =>
      apiClient<{ items: CustomerDriverBooking[] }>('/driver-go/bookings'),
  });
}

export function useMyDriverBooking(id: string) {
  return useQuery({
    queryKey: ['myDriverBooking', id],
    enabled: Boolean(id),
    refetchInterval: 15000,
    queryFn: async () =>
      apiClient<CustomerDriverBooking>(`/driver-go/bookings/${id}`),
  });
}

export function useCancelDriverBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiClient<CustomerDriverBooking>(`/driver-go/bookings/${id}/cancel`, {
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['myDriverBookings'] });
      queryClient.invalidateQueries({ queryKey: ['myDriverBooking', id] });
    },
  });
}

export function useFetchStartCode(id: string) {
  return useMutation({
    mutationFn: async () =>
      apiClient<{ code: string }>(
        `/driver-go/bookings/${id}/start-code`,
      ),
  });
}
