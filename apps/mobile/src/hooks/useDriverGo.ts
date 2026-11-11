import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export type DriverAvailabilityRule = {
  id?: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type DriverMe = {
  id: string;
  businessName: string;
  phone: string;
  email?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  isOnline: boolean;
  avgRating: number;
  totalReviews: number;
  completedJobs: number;
  driver: {
    licenceNumber: string | null;
    licenceExpiry: string | null;
    experienceYears: number;
    languages: string[];
    transmissions: string[];
    hourlyRate: number;
    dailyRate: number;
    maxHoursPerDay: number;
  };
  availability: DriverAvailabilityRule[];
  stats: {
    upcoming: number;
    completedToday: number;
    earningsToday: number;
  };
};

export type DriverJob = {
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
  destinationAddress: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  startAt: string;
  endAt: string;
  durationHours: number | null;
  durationDays: number | null;
  notes: string | null;
  transmission: string | null;
  totalAmount: number;
  driverEarning: number;
  platformFee: number;
  acceptedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  customer: {
    firstName: string;
    lastName: string;
    phoneMasked: string | null;
  };
  vehicle: {
    make: string;
    model: string;
    year: number;
    registrationNumber: string;
    transmission: string | null;
    fuelType: string;
  } | null;
};

export type DriverEarnings = {
  today: number;
  week: number;
  month: number;
  trips: DriverJob[];
};

export function useDriverMe() {
  return useQuery({
    queryKey: ['driverMe'],
    queryFn: async () => apiClient<DriverMe>('/driver-go/me'),
  });
}

export function useDriverJobs(status?: DriverJob['status']) {
  return useQuery({
    queryKey: ['driverJobs', status ?? 'all'],
    queryFn: async () =>
      apiClient<{ items: DriverJob[] }>(
        status ? `/driver-go/jobs?status=${status}` : '/driver-go/jobs',
      ),
  });
}

export function useDriverJob(id: string) {
  return useQuery({
    queryKey: ['driverJob', id],
    enabled: Boolean(id),
    queryFn: async () => apiClient<DriverJob>(`/driver-go/jobs/${id}`),
  });
}

export function useSetDriverOnline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isOnline: boolean) =>
      apiClient<{ isOnline: boolean }>('/driver-go/online', {
        method: 'PATCH',
        body: JSON.stringify({ isOnline }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverMe'] });
    },
  });
}

export function useDriverAvailability() {
  return useQuery({
    queryKey: ['driverAvailability'],
    queryFn: async () =>
      apiClient<{ rules: DriverAvailabilityRule[] }>(
        '/driver-go/availability',
      ),
  });
}

export function useSaveDriverAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      rules: Pick<DriverAvailabilityRule, 'weekday' | 'startMinute' | 'endMinute'>[],
    ) =>
      apiClient<{ rules: DriverAvailabilityRule[] }>(
        '/driver-go/availability',
        {
          method: 'PUT',
          body: JSON.stringify({ rules }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverAvailability'] });
      queryClient.invalidateQueries({ queryKey: ['driverMe'] });
    },
  });
}

function invalidateJobs(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['driverJobs'] });
  queryClient.invalidateQueries({ queryKey: ['driverMe'] });
  queryClient.invalidateQueries({ queryKey: ['driverEarnings'] });
}

export function useAcceptDriverJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiClient<DriverJob>(`/driver-go/jobs/${id}/accept`, {
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      invalidateJobs(queryClient);
      queryClient.invalidateQueries({ queryKey: ['driverJob', id] });
    },
  });
}

export function useDeclineDriverJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      apiClient<DriverJob>(`/driver-go/jobs/${id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_data, variables) => {
      invalidateJobs(queryClient);
      queryClient.invalidateQueries({ queryKey: ['driverJob', variables.id] });
    },
  });
}

export function useUpdateDriverJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: 'DRIVER_EN_ROUTE' | 'ARRIVED' | 'COMPLETED';
    }) =>
      apiClient<DriverJob>(`/driver-go/jobs/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, variables) => {
      invalidateJobs(queryClient);
      queryClient.invalidateQueries({ queryKey: ['driverJob', variables.id] });
    },
  });
}

export function useVerifyDriverStartOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) =>
      apiClient<DriverJob>(`/driver-go/jobs/${id}/verify-start-otp`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: (_data, variables) => {
      invalidateJobs(queryClient);
      queryClient.invalidateQueries({ queryKey: ['driverJob', variables.id] });
    },
  });
}

export function useDriverEarnings() {
  return useQuery({
    queryKey: ['driverEarnings'],
    queryFn: async () => apiClient<DriverEarnings>('/driver-go/earnings'),
  });
}
