import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';

/**
 * Admin hooks — Checkpoint 3 (provider verification).
 * Endpoints: GET /admin/providers, PATCH /admin/providers/:id/verify
 * (ADMIN-role gated server side).
 */

export type ProviderVerificationRecord = {
  id: string;
  businessName: string;
  providerType: string;
  phone: string;
  address: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
};

export function useAdminProviders(status?: string) {
  return useQuery({
    queryKey: ['adminProviders', status],
    queryFn: async () => {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await apiClient<
        { items: ProviderVerificationRecord[] } | ProviderVerificationRecord[]
      >(`/admin/providers${qs}`);
      // tolerate both shapes (defensive: older CLI cached payloads)
      if (Array.isArray(res)) return { items: res };
      return res;
    },
  });
}

export function useVerifyProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      auditorNotes,
    }: {
      id: string;
      status: ProviderVerificationRecord['verificationStatus'];
      auditorNotes?: string;
    }) => {
      return apiClient<ProviderVerificationRecord>(`/admin/providers/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status, auditorNotes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProviders'] });
      queryClient.invalidateQueries({ queryKey: ['adminProviderDetail'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    },
  });
}

export type AdminOverview = {
  totalRequests: number;
  openBroadcasts: number;
  totalQuotations: number;
  acceptedQuotations: number;
  totalBookings: number;
  completedBookings: number;
  totalEscrowVolume: number;
  pendingVerifications: number;
  verifiedProviders: number;
};

export type AdminProviderDetail = ProviderVerificationRecord & {
  email: string;
  verificationDocuments?: Record<string, string> | null;
  verifiedAt?: string;
  auditorNotes?: string;
  counts: {
    quotations: number;
    bookings: number;
    reviews: number;
    listings: number;
  };
};

export type EscrowEntry = {
  bookingId: string;
  paymentId?: string;
  customerName: string;
  providerName: string;
  amount: number;
  status: 'HELD_IN_ESCROW' | 'RELEASED_TO_PROVIDER' | 'REFUNDED_TO_CUSTOMER';
  bookingStatus?: string;
  payoutReference?: string;
  confirmedAt: string;
  completedAt?: string;
  releasedAt?: string;
};

export type AdminActivityLog = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};

export type AdminActivityStats = {
  days: {
    date: string;
    requests: number;
    bookings: number;
    quotations: number;
    sparePartOrders: number;
  }[];
  totals: { users: number; providers: number };
};

export function useAdminOverview() {
  return useQuery({
    queryKey: ['adminOverview'],
    queryFn: async () => apiClient<AdminOverview>('/admin/overview'),
  });
}

export function useAdminProviderDetail(id?: string) {
  return useQuery({
    queryKey: ['adminProviderDetail', id],
    queryFn: async () => apiClient<AdminProviderDetail>(`/admin/providers/${id}`),
    enabled: !!id,
  });
}

export function useAdminEscrow() {
  return useQuery({
    queryKey: ['adminEscrow'],
    queryFn: async () => apiClient<EscrowEntry[]>('/admin/escrow-ledger'),
  });
}

export function useAdminActivity(params?: { action?: string; limit?: number }) {
  return useQuery({
    queryKey: ['adminActivity', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.action) qs.set('action', params.action);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiClient<{ items: AdminActivityLog[]; nextCursor?: string | null }>(
        `/admin/activity-logs?${qs.toString()}`,
      );
    },
  });
}

export function useAdminActivityStats() {
  return useQuery({
    queryKey: ['adminActivityStats'],
    queryFn: async () => apiClient<AdminActivityStats>('/admin/activity-stats'),
  });
}

export type AdminOrder = {
  id: string;
  status: string;
  fulfillmentStatus: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  carrierName: string | null;
  trackingNumber: string | null;
  sparePart: { name: string; partNumber: string } | null;
  provider: { businessName: string; providerType: string } | null;
  customer: { firstName: string; lastName: string } | null;
};

export type AdminBooking = {
  id: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  completedAt: string | null;
  completionNotes: string | null;
  customer: { firstName: string; lastName: string } | null;
  provider: { businessName: string; providerType: string } | null;
  request: {
    id: string;
    title: string;
    category: string;
    address: string;
  } | null;
  totalCost: number;
  payment: { id: string; status: string; amount: number } | null;
};

export function useAdminOrders(params?: {
  status?: string;
  fulfillmentStatus?: string;
}) {
  return useQuery({
    queryKey: ['adminOrders', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.fulfillmentStatus)
        qs.set('fulfillmentStatus', params.fulfillmentStatus);
      return apiClient<{ items: AdminOrder[] }>(`/admin/orders?${qs.toString()}`);
    },
  });
}

export function useAdminBookings(params?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ['adminBookings', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.category) qs.set('category', params.category);
      return apiClient<{ items: AdminBooking[] }>(
        `/admin/bookings?${qs.toString()}`,
      );
    },
  });
}

export function useAdminRefundOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) =>
      apiClient(`/spare-parts/orders/${orderId}/refund`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    },
  });
}

export function useAdminRefundBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) =>
      apiClient(`/admin/bookings/${bookingId}/refund`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    },
  });
}
