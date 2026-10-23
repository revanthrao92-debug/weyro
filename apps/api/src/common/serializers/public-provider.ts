import {
  computeProviderBadge,
  VerificationStatus,
} from '@weyro/api-contracts';

/**
 * Fields safe to expose to customers on quotations, bookings, chats and
 * public provider pages. Never widen this to the full provider row: it
 * contains phone, exact address, KYC documents and internal audit fields.
 */
export const PUBLIC_PROVIDER_SELECT = {
  id: true,
  businessName: true,
  providerType: true,
  description: true,
  serviceRadiusKm: true,
  verificationStatus: true,
  avgRating: true,
  totalReviews: true,
  completedJobs: true,
  isAvailable: true,
} as const;

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

export const PUBLIC_CUSTOMER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

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
