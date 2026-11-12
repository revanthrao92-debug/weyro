import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export type ProviderDashboardData = {
  provider: {
    id: string;
    businessName: string;
    providerType: string;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
    isAvailable: boolean;
    avgRating: number;
    totalReviews: number;
    completedJobs: number;
    serviceRadiusKm: number;
  };
  counts: {
    openRequests: number;
    pendingQuotes: number;
    pendingOrders: number;
    activeListings: number;
    lowStock: number;
  };
  revenue: {
    paidTotal: number;
    todayPaid: number;
    inventoryValue: number;
  };
  recentOrders: {
    id: string;
    totalAmount: number;
    status: string;
    fulfillmentStatus: string;
    createdAt: string;
    sparePart: { name: string; partNumber: string } | null;
    customer: { firstName: string; lastName: string } | null;
  }[];
  jobs: {
    active: number;
    completed: number;
    today: number;
    recent: {
      id: string;
      status: string;
      scheduledAt: string | null;
      createdAt: string;
      completedAt: string | null;
      customer: { firstName: string; lastName: string } | null;
      request: {
        id: string;
        title: string;
        category: string;
        address: string;
        vehicle: { make: string; model: string; year: number | null } | null;
      } | null;
      totalCost: number;
    }[];
  };
  recentQuotes: {
    id: string;
    totalCost: number;
    status: string;
    createdAt: string;
    request: { id: string; title: string; category: string } | null;
  }[];
};

export function useProviderDashboard() {
  return useQuery({
    queryKey: ['providerDashboard'],
    queryFn: async () =>
      apiClient<ProviderDashboardData>('/providers/me/dashboard'),
  });
}
