import {
  computeProviderBadge,
  VerificationStatus,
} from '@weyro/api-contracts';

/**
 * Fields safe to expose to customers on quotations, bookings, chats and
 * public provider pages. Never widen this to the full provider row: it
 * contains phone, exact address, KYC documents and internal audit fields.
 */
export interface PublicProviderSource {
  id: string;
  businessName: string;
  providerType: string;
  description?: string | null;
  serviceRadiusKm?: number | null;
  verificationStatus: VerificationStatus;
  avgRating: number;
  totalReviews: number;
  completedJobs: number;
  isAvailable: boolean;
}

export function toPublicProvider<T extends PublicProviderSource>(provider: T) {
  return {
    id: provider.id,
    businessName: provider.businessName,
    providerType: provider.providerType,
    description: provider.description ?? null,
    serviceRadiusKm: provider.serviceRadiusKm ?? null,
    avgRating: provider.avgRating,
    totalReviews: provider.totalReviews,
    completedJobs: provider.completedJobs,
    isAvailable: provider.isAvailable,
    badge: computeProviderBadge({
      verificationStatus: provider.verificationStatus,
      avgRating: provider.avgRating,
      completedJobs: provider.completedJobs,
      isAvailable: provider.isAvailable,
    }),
  };
}

export function toPublicCustomer(customer: {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    avatarUrl: customer.avatarUrl ?? null,
  };
}

/** Payment data that is safe for customers/providers (no gateway internals). */
export function toPaymentSummary(payment: any) {
  if (!payment) return null;
  return {
    id: payment.id,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method ?? null,
    paidAt: payment.paidAt ?? null,
    releasedAt: payment.paidToProviderAt ?? null,
  };
}
