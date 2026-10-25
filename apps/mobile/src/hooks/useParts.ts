import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { Alert } from 'react-native';

export type SparePart = {
  id: string;
  providerId: string;
  name: string;
  partNumber: string;
  compatibleMakes: string[];
  compatibleModels: string[];
  condition: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  ordersCount?: number;
};

export type CreateSparePart = {
  name: string;
  partNumber: string;
  compatibleMakes: string[];
  compatibleModels: string[];
  condition: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
  kind?: string;
  description?: string;
  estimatedMinutes?: number;
};

export type UpdateSparePart = Partial<CreateSparePart> & {
  isActive?: boolean;
};

export type SparePartOrder = {
  id: string;
  sparePartId: string;
  providerId: string;
  customerId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  status: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

export type CreateSparePartOrder = {
  quantity: number;
};

export type VerifySparePartOrder = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

/** Parts catalogue (public) */
export function useParts(params?: {
  search?: string;
  make?: string;
  model?: string;
  condition?: string;
  kind?: string;
  cursor?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['parts', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.make) qs.set('make', params.make);
      if (params?.model) qs.set('model', params.model);
      if (params?.condition) qs.set('condition', params.condition);
      if (params?.kind) qs.set('kind', params.kind);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiClient<{ items: SparePart[]; nextCursor?: string | null }>(
        `/spare-parts?${qs.toString()}`
      );
    },
  });
}

/** My listings (provider/admin) */
export function useMyParts(params?: {
  cursor?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['myParts', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiClient<{ items: SparePart[]; nextCursor?: string | null }>(
        `/spare-parts/mine?${qs.toString()}`
      );
    },
  });
}

export function useCreateSparePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSparePart) => {
      return apiClient<SparePart>('/spare-parts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myParts'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

export function useUpdateSparePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpdateSparePart) => {
      return apiClient<SparePart>(`/spare-parts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['myParts'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['part', variables.id] });
    },
  });
}

export function useDeleteSparePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/spare-parts/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myParts'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

/** Part detail */
export function useSparePart(id: string) {
  return useQuery({
    queryKey: ['part', id],
    queryFn: async () => apiClient<SparePart>(`/spare-parts/${id}`),
    enabled: !!id,
  });
}

/** Customer orders */
export function useMyOrders() {
  return useQuery({
    queryKey: ['myOrders'],
    queryFn: async () => apiClient<SparePartOrder[]>('/spare-parts/orders/my'),
  });
}

/** Dealer orders */
export function useDealerOrders(params?: { status?: string; cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: ['dealerOrders', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiClient<{ items: SparePartOrder[]; nextCursor?: string | null }>(
        `/spare-parts/orders/dealer?${qs.toString()}`
      );
    },
  });
}

/** Create order */
export function useCreateSparePartOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ partId, quantity }: { partId: string; quantity: number }) => {
      return apiClient<{ orderId: string; gatewayOrderId: string; amount: number }>(
        `/spare-parts/${partId}/orders`,
        {
          method: 'POST',
          body: JSON.stringify({ quantity }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myParts'] });
      queryClient.invalidateQueries({ queryKey: ['dealerOrders'] });
    },
  });
}

/** Verify order payment */
export function useVerifySparePartOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    }: VerifySparePartOrder & { orderId: string }) => {
      return apiClient<{ orderId: string; status: string }>(
        `/spare-parts/orders/${orderId}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
          }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['dealerOrders'] });
    },
  });
}

/** Cancel order */
export function useCancelSparePartOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return apiClient(`/spare-parts/orders/${orderId}/cancel`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['dealerOrders'] });
    },
  });
}
