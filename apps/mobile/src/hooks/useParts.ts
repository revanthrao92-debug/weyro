import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export type SparePart = {
  id: string;
  providerId: string;
  name: string;
  partNumber: string;
  compatibleMakes: string[];
  compatibleModels: string[];
  condition: string;
  price: number;
  /** Dealer views only — public catalogue responses expose `inStock` instead. */
  stockQuantity?: number;
  inStock?: boolean;
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
  fulfillmentStatus?: string;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingPincode?: string | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  dealerNotes?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  refundedAt?: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  /** Joined by the API on dealer/customer order lists */
  sparePart?: {
    id: string;
    name: string;
    partNumber: string;
    imageUrl?: string | null;
  } | null;
  customer?: { firstName: string; lastName: string } | null;
  provider?: {
    businessName: string;
    verificationStatus?: string;
    avgRating?: number;
  } | null;
};

export type CreateSparePartOrder = {
  quantity: number;
  shippingName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingPincode?: string;
};

export type FulfillmentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED';

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
    // Keep showing the last results while a new search loads (no skeleton flash).
    placeholderData: keepPreviousData,
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
export function useDealerOrders(params?: {
  status?: string;
  fulfillmentStatus?: string;
  cursor?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['dealerOrders', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.fulfillmentStatus)
        qs.set('fulfillmentStatus', params.fulfillmentStatus);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiClient<{ items: SparePartOrder[]; nextCursor?: string | null }>(
        `/spare-parts/orders/dealer?${qs.toString()}`
      );
    },
  });
}

export function useSparePartOrder(id: string) {
  return useQuery({
    queryKey: ['sparePartOrder', id],
    queryFn: async () => apiClient<SparePartOrder>(`/spare-parts/orders/${id}`),
    enabled: !!id,
  });
}

export function useUpdateFulfillment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      carrierName,
      trackingNumber,
      dealerNotes,
    }: {
      orderId: string;
      status: FulfillmentStatus;
      carrierName?: string;
      trackingNumber?: string;
      dealerNotes?: string;
    }) => {
      return apiClient<{
        orderId: string;
        status: string;
        fulfillmentStatus: string;
      }>(`/spare-parts/orders/${orderId}/fulfillment`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(carrierName ? { carrierName } : {}),
          ...(trackingNumber ? { trackingNumber } : {}),
          ...(dealerNotes ? { dealerNotes } : {}),
        }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dealerOrders'] });
      queryClient.invalidateQueries({ queryKey: ['sparePartOrder', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['providerDashboard'] });
    },
  });
}

/** Create order */
export function useCreateSparePartOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      partId,
      quantity,
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingCity,
      shippingPincode,
    }: { partId: string } & CreateSparePartOrder) => {
      return apiClient<{ orderId: string; gatewayOrderId: string; amount: number }>(
        `/spare-parts/${partId}/orders`,
        {
          method: 'POST',
          body: JSON.stringify({
            quantity,
            ...(shippingName ? { shippingName } : {}),
            ...(shippingPhone ? { shippingPhone } : {}),
            ...(shippingAddress ? { shippingAddress } : {}),
            ...(shippingCity ? { shippingCity } : {}),
            ...(shippingPincode ? { shippingPincode } : {}),
          }),
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
