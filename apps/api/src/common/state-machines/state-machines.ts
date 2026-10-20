import { ConflictException } from '@nestjs/common';
import {
  BookingStatus,
  PaymentStatus,
  QuotationStatus,
  ServiceRequestStatus,
  UserRole,
} from '@weyro/api-contracts';

export type ActorRole = UserRole | 'SYSTEM';

interface TransitionRule<T> {
  from: T;
  to: T;
  allowedActors: ActorRole[];
}

// 1. ServiceRequest State Machine
export const SERVICE_REQUEST_TRANSITIONS: TransitionRule<ServiceRequestStatus>[] = [
  { from: 'DRAFT', to: 'OPEN', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'DRAFT', to: 'CANCELLED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'OPEN', to: 'QUOTES_RECEIVED', allowedActors: ['PROVIDER', 'BOTH', 'SYSTEM', 'ADMIN'] },
  { from: 'OPEN', to: 'ACCEPTED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'OPEN', to: 'CANCELLED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'OPEN', to: 'EXPIRED', allowedActors: ['SYSTEM', 'ADMIN'] },
  { from: 'QUOTES_RECEIVED', to: 'ACCEPTED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'QUOTES_RECEIVED', to: 'CANCELLED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'QUOTES_RECEIVED', to: 'EXPIRED', allowedActors: ['SYSTEM', 'ADMIN'] },
  { from: 'ACCEPTED', to: 'IN_PROGRESS', allowedActors: ['PROVIDER', 'BOTH', 'SYSTEM', 'ADMIN'] },
  { from: 'IN_PROGRESS', to: 'COMPLETED', allowedActors: ['PROVIDER', 'BOTH', 'SYSTEM', 'ADMIN'] },
  { from: 'IN_PROGRESS', to: 'CANCELLED', allowedActors: ['ADMIN'] },
];

export function validateServiceRequestTransition(
  currentStatus: ServiceRequestStatus,
  targetStatus: ServiceRequestStatus,
  actorRole: ActorRole,
): void {
  if (currentStatus === targetStatus) return;

  const rule = SERVICE_REQUEST_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.to === targetStatus,
  );

  if (!rule) {
    throw new ConflictException(
      `Illegal ServiceRequest status transition: cannot transition from ${currentStatus} to ${targetStatus}`,
    );
  }

  if (actorRole !== 'ADMIN' && actorRole !== 'SYSTEM' && !rule.allowedActors.includes(actorRole)) {
    throw new ConflictException(
      `Actor ${actorRole} is not authorized to transition ServiceRequest from ${currentStatus} to ${targetStatus}`,
    );
  }
}

// 2. Quotation State Machine
export const QUOTATION_TRANSITIONS: TransitionRule<QuotationStatus>[] = [
  { from: 'PENDING', to: 'ACCEPTED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'PENDING', to: 'REJECTED', allowedActors: ['CUSTOMER', 'BOTH', 'SYSTEM', 'ADMIN'] },
  { from: 'PENDING', to: 'WITHDRAWN', allowedActors: ['PROVIDER', 'BOTH', 'ADMIN'] },
  { from: 'PENDING', to: 'EXPIRED', allowedActors: ['SYSTEM', 'ADMIN'] },
];

export function validateQuotationTransition(
  currentStatus: QuotationStatus,
  targetStatus: QuotationStatus,
  actorRole: ActorRole,
): void {
  if (currentStatus === targetStatus) return;

  const rule = QUOTATION_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.to === targetStatus,
  );

  if (!rule) {
    throw new ConflictException(
      `Illegal Quotation status transition: cannot transition from ${currentStatus} to ${targetStatus}`,
    );
  }

  if (actorRole !== 'ADMIN' && actorRole !== 'SYSTEM' && !rule.allowedActors.includes(actorRole)) {
    throw new ConflictException(
      `Actor ${actorRole} is not authorized to transition Quotation from ${currentStatus} to ${targetStatus}`,
    );
  }
}

// 3. Booking State Machine
export const BOOKING_TRANSITIONS: TransitionRule<BookingStatus>[] = [
  { from: 'CONFIRMED', to: 'PROVIDER_EN_ROUTE', allowedActors: ['PROVIDER', 'BOTH', 'ADMIN'] },
  { from: 'CONFIRMED', to: 'IN_PROGRESS', allowedActors: ['PROVIDER', 'BOTH', 'ADMIN'] },
  { from: 'CONFIRMED', to: 'CANCELLED', allowedActors: ['CUSTOMER', 'PROVIDER', 'BOTH', 'ADMIN'] },
  { from: 'PROVIDER_EN_ROUTE', to: 'IN_PROGRESS', allowedActors: ['PROVIDER', 'BOTH', 'ADMIN'] },
  { from: 'PROVIDER_EN_ROUTE', to: 'CANCELLED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'IN_PROGRESS', to: 'COMPLETED', allowedActors: ['PROVIDER', 'BOTH', 'ADMIN'] },
  { from: 'IN_PROGRESS', to: 'DISPUTED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
  { from: 'COMPLETED', to: 'DISPUTED', allowedActors: ['CUSTOMER', 'BOTH', 'ADMIN'] },
];

export function validateBookingTransition(
  currentStatus: BookingStatus,
  targetStatus: BookingStatus,
  actorRole: ActorRole,
): void {
  if (currentStatus === targetStatus) return;

  const rule = BOOKING_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.to === targetStatus,
  );

  if (!rule) {
    throw new ConflictException(
      `Illegal Booking status transition: cannot transition from ${currentStatus} to ${targetStatus}`,
    );
  }

  if (actorRole !== 'ADMIN' && actorRole !== 'SYSTEM' && !rule.allowedActors.includes(actorRole)) {
    throw new ConflictException(
      `Actor ${actorRole} is not authorized to transition Booking from ${currentStatus} to ${targetStatus}`,
    );
  }
}

// 4. Payment State Machine
export const PAYMENT_TRANSITIONS: TransitionRule<PaymentStatus>[] = [
  { from: 'PENDING', to: 'AUTHORIZED', allowedActors: ['SYSTEM', 'ADMIN', 'CUSTOMER'] },
  { from: 'PENDING', to: 'CAPTURED', allowedActors: ['SYSTEM', 'ADMIN', 'CUSTOMER'] },
  { from: 'PENDING', to: 'FAILED', allowedActors: ['SYSTEM', 'ADMIN'] },
  { from: 'AUTHORIZED', to: 'CAPTURED', allowedActors: ['SYSTEM', 'ADMIN'] },
  { from: 'AUTHORIZED', to: 'FAILED', allowedActors: ['SYSTEM', 'ADMIN'] },
  { from: 'AUTHORIZED', to: 'REFUNDED', allowedActors: ['SYSTEM', 'ADMIN'] },
  { from: 'CAPTURED', to: 'REFUNDED', allowedActors: ['ADMIN', 'SYSTEM'] },
];

export function validatePaymentTransition(
  currentStatus: PaymentStatus,
  targetStatus: PaymentStatus,
  actorRole: ActorRole,
): void {
  if (currentStatus === targetStatus) return;

  const rule = PAYMENT_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.to === targetStatus,
  );

  if (!rule) {
    throw new ConflictException(
      `Illegal Payment status transition: cannot transition from ${currentStatus} to ${targetStatus}`,
    );
  }

  if (actorRole !== 'ADMIN' && actorRole !== 'SYSTEM' && !rule.allowedActors.includes(actorRole)) {
    throw new ConflictException(
      `Actor ${actorRole} is not authorized to transition Payment from ${currentStatus} to ${targetStatus}`,
    );
  }
}
