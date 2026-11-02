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
    },
  });
}
