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
        /** What moved the forecast, biggest effect first; amount in ₹ over the whole horizon. */
        factors: { key: string; label: string; detail: string; amount: number }[];
        /** Factors left out, with the reason (not enough history, nothing coming up...). */
        skipped: { key: string; label: string; reason: string }[];
        /** How close past forecasts came on this dealer's own sales; null until there's enough history. */
        accuracy: { withinPct: number; checks: number } | null;
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
