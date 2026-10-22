// User & Auth
export type UserRole = 'CUSTOMER' | 'PROVIDER' | 'BOTH' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  savedAddresses?: Array<{
    title: string;
    address: string;
    latitude: number;
    longitude: number;
  }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Vehicles
export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG';

export interface Vehicle {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  registrationNumber: string;
  vinNumber?: string;
  fuelType: FuelType;
  color?: string;
  createdAt: string;
}

// Provider Profile
export type ProviderType =
  | 'MECHANIC'
  | 'GARAGE'
  | 'AUTHORIZED_CENTER'
  | 'PARTS_DEALER'
  | 'TOWING'
  | 'ROADSIDE';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export type TowingVehicleType = 'FLATBED' | 'HOOK_AND_CHAIN' | 'MOTORCYCLE' | 'ANY';

/**
 * Platform towing tariff. Providers may override with their own base/per-km
 * fees; this is the fallback used to show customers an upfront estimate.
 */
export const TOWING_TARIFF = {
  baseFee: 500,
  perKmFee: 40,
  minimumFare: 500,
} as const;

export function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Number((2 * R * Math.asin(Math.sqrt(a))).toFixed(2));
}

export function estimateTowingFare(
  distanceKm: number,
  tariff: { baseFee: number; perKmFee: number; minimumFare: number } = TOWING_TARIFF,
): number {
  const raw = tariff.baseFee + tariff.perKmFee * Math.max(0, distanceKm);
  return Math.max(tariff.minimumFare, Math.round(raw));
}

/**
 * Which request categories a provider type is eligible to see/quote on.
 * Used by the broadcast feed and by client-side filtering.
 */
export const PROVIDER_TYPE_CATEGORIES: Record<ProviderType, ServiceCategory[]> = {
  MECHANIC: ['REPAIR', 'MAINTENANCE', 'INSPECTION'],
  GARAGE: ['REPAIR', 'MAINTENANCE', 'INSPECTION'],
  AUTHORIZED_CENTER: ['REPAIR', 'MAINTENANCE', 'INSPECTION'],
  PARTS_DEALER: ['SPARE_PART'],
  TOWING: ['TOWING'],
  ROADSIDE: ['ROADSIDE'],
};

export interface ProviderProfile {
  id: string;
  userId: string;
  businessName: string;
  providerType: ProviderType;
  description: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  verificationStatus: VerificationStatus;
  verificationDocuments?: Record<string, string>;
  avgRating: number;
  totalReviews: number;
  completedJobs: number;
  isAvailable: boolean;
  towingVehicleTypes?: TowingVehicleType[];
  maxVehicleWeightKg?: number;
  towingBaseFee?: number;
  towingPerKmFee?: number;
}

// Service Request
export type ServiceCategory =
  | 'REPAIR'
  | 'MAINTENANCE'
  | 'SPARE_PART'
  | 'TOWING'
  | 'ROADSIDE'
  | 'INSPECTION';

export type Urgency = 'NORMAL' | 'URGENT' | 'EMERGENCY';

export type ServiceRequestStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'QUOTES_RECEIVED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type BroadcastScope = 'LOCAL_RADIUS' | 'BROADCAST_ALL';

export interface ServiceRequest {
  id: string;
  customerId: string;
  vehicleId: string;
  vehicle?: Vehicle;
  category: ServiceCategory;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  urgency: Urgency;
  status: ServiceRequestStatus;
  mediaUrls: string[];
  damagePhotos: string[];
  isBroadcast: boolean;
  fulfillmentType?: 'ON_SITE' | 'WORKSHOP_VISIT' | 'PARTS_SHIPPING' | 'TOW_TO_GARAGE';
  dropoffAddress?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  towingVehicleType?: TowingVehicleType;
  vehicleWeightKg?: number;
  towingDistanceKm?: number;
  towingEstimatedFare?: number;
  expiresAt: string;
  createdAt: string;
  quotationsCount?: number;
}

// Quotation
export type PartCondition = 'OEM' | 'AFTERMARKET' | 'USED';

export type QuotationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';

export type DeliveryMethod = 'PICKUP' | 'DOORSTEP_DELIVERY' | 'PARTS_COURIER' | 'ON_SITE_FITMENT';

export interface Quotation {
  id: string;
  requestId: string;
  providerId: string;
  provider?: ProviderProfile;
  partsCost: number;
  labourCost: number;
  shippingCost?: number;
  totalCost: number;
  partCondition?: PartCondition;
  warrantyDays: number;
  etaDescription: string;
  deliveryMethod?: DeliveryMethod;
  notes?: string;
  status: QuotationStatus;
  createdAt: string;
}

// Booking
export type BookingStatus =
  | 'CONFIRMED'
  | 'PROVIDER_EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export interface Booking {
  id: string;
  quotationId: string;
  customerId: string;
  providerId: string;
  status: BookingStatus;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  completionNotes?: string;
  createdAt: string;
}

// Spare Part
export interface SparePart {
  id: string;
  providerId: string;
  name: string;
  partNumber: string;
  compatibleMakes: string[];
  compatibleModels: string[];
  condition: PartCondition;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
}

// Payment
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'RELEASED' | 'REFUNDED' | 'FAILED';
export type PaymentMethod = 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  method: PaymentMethod;
  paidAt?: string;
  createdAt: string;
}

// Review
export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

// Admin & Platform Scale (Tier 3)
export interface AdminOverviewMetrics {
  totalRequests: number;
  openBroadcasts: number;
  totalQuotations: number;
  acceptedQuotations: number;
  totalBookings: number;
  completedBookings: number;
  totalEscrowVolume: number;
  pendingVerifications: number;
  verifiedProviders: number;
}

export interface ProviderVerificationRecord {
  id: string;
  businessName: string;
  providerType: ProviderType;
  phone: string;
  address: string;
  verificationStatus: VerificationStatus;
  licenseNumber?: string;
  taxId?: string;
  createdAt: string;
  auditorNotes?: string;
}

export interface EscrowLedgerEntry {
  bookingId: string;
  customerName: string;
  providerName: string;
  amount: number;
  status: 'HELD_IN_ESCROW' | 'RELEASED_TO_PROVIDER' | 'REFUNDED_TO_CUSTOMER';
  confirmedAt: string;
  completedAt?: string;
}
