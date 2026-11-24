import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export type AnalyticsBucket = {
  date: string;
  gross: number;
  refunds: number;
  net: number;
  orders: number;
};

export type ProviderAnalytics = {
  periodDays: number;
  currency: string;
  summary: {
    grossSales: number;
    refundAmount: number;
    netSales: number;
    paidOrders: number;
    refundedOrders: number;
    averageOrderValue: number;
    pendingValue: number;
    inventoryValue: number;
    activeListings: number;
    lowStockListings: number;
    quotesSent: number;
    quotesAccepted: number;
    quoteConversionRate: number;
  };
  buckets: AnalyticsBucket[];
  forecast:
    | {
        available: true;
        horizonDays: number;
        slopePerDay: number;
        projectedTotal: number;
        projectedLow: number;
        projectedHigh: number;
        trend: 'UP' | 'DOWN' | 'FLAT';
        points: { date: string; value: number; low: number; high: number }[];
      }
    | { available: false; reason: string };
};

export function useProviderAnalytics(days: number) {
  return useQuery({
    queryKey: ['providerAnalytics', days],
    queryFn: async () =>
      apiClient<ProviderAnalytics>(`/providers/me/analytics?days=${days}`),
  });
}
