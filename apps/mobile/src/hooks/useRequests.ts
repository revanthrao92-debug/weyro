import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { Alert } from 'react-native';

export type ServiceRequest = {
  id: string;
  customerId: string;
  vehicleId: string;
  vehicle?: any;
  category: string;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  urgency: string;
  status: string;
  mediaUrls: string[];
  damagePhotos: string[];
  isBroadcast: boolean;
  fulfillmentType?: string;
  dropoffAddress?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  towingVehicleType?: string;
  vehicleWeightKg?: number;
  towingDistanceKm?: number;
  towingEstimatedFare?: number;
  expiresAt: string;
  createdAt: string;
  quotationsCount?: number;
  quotations?: Quotation[];
};

export type Quotation = {
  id: string;
  requestId: string;
  providerId: string;
  provider?: any;
  partsCost: number;
  labourCost: number;
  shippingCost?: number;
  totalCost: number;
  partCondition?: string;
  warrantyDays: number;
  etaDescription: string;
  deliveryMethod?: string;
  notes?: string;
  status: string;
  createdAt: string;
};

export type CreateServiceRequest = {
  vehicleId?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  category: string;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  urgency: string;
  mediaUrls: string[];
  damagePhotos: string[];
  isBroadcast: boolean;
  fulfillmentType?: string;
  dropoffAddress?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  towingVehicleType?: string;
  vehicleWeightKg?: number;
  expiresInDays?: number;
};

export type CreateQuotation = {
  partsCost: number;
  labourCost: number;
  shippingCost?: number;
  partCondition?: string;
  warrantyDays: number;
  etaDescription: string;
  deliveryMethod?: string;
  notes?: string;
};

export type AcceptQuotation = {
  scheduledDate?: string;
  deliveryAddress?: string;
  notes?: string;
};

/** Customer requests */
export function useMyRequests(params?: { cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: ['myRequests', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiClient<{ items: ServiceRequest[]; nextCursor?: string | null }>(
        `/damage-requests/my?${qs.toString()}`
      );
    },
  });
}

export function useBroadcastFeed(params?: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  category?: string;
  cursor?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['broadcastFeed', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.lat !== undefined) qs.set('lat', String(params.lat));
      if (params?.lng !== undefined) qs.set('lng', String(params.lng));
      if (params?.radiusKm) qs.set('radiusKm', String(params.radiusKm));
      if (params?.category) qs.set('category', params.category);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiClient<{ items: ServiceRequest[]; nextCursor?: string | null }>(
        `/damage-requests/broadcast-feed?${qs.toString()}`
      );
    },
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: async () => apiClient<ServiceRequest>(`/damage-requests/${id}`),
    enabled: !!id,
  });
}

export function useCreateServiceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateServiceRequest) => {
      return apiClient<ServiceRequest>('/damage-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      queryClient.invalidateQueries({ queryKey: ['broadcastFeed'] });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<ServiceRequest>(`/damage-requests/${id}/cancel`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
    },
  });
}

/** Quotations */
export function useRequestQuotations(requestId: string) {
  return useQuery({
    queryKey: ['quotations', requestId],
    queryFn: async () =>
      apiClient<{ items: Quotation[]; nextCursor?: string | null }>(
        `/damage-requests/${requestId}/quotations`
      ),
    enabled: !!requestId,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      data,
    }: {
      requestId: string;
      data: CreateQuotation;
    }) => {
      return apiClient<Quotation>(
        `/damage-requests/${requestId}/quotations`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['quotations', variables.requestId],
      });
    },
  });
}

export function useAcceptQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quotationId,
      data,
    }: {
      quotationId: string;
      data: AcceptQuotation;
    }) => {
      return apiClient(`/quotations/${quotationId}/accept`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useMyQuotations(params?: { cursor?: string; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['myQuotations', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.status) qs.set('status', params.status);
      return apiClient<{ items: Quotation[]; nextCursor?: string | null }>(
        `/quotations/my?${qs.toString()}`
      );
    },
  });
}

export function useWithdrawQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<Quotation>(`/quotations/${id}/withdraw`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myQuotations'] });
    },
  });
}
