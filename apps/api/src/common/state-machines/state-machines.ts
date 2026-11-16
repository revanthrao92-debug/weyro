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
  { from: 'DISPUTED', to: 'IN_PROGRESS', allowedActors: ['ADMIN'] },
  { from: 'DISPUTED', to: 'COMPLETED', allowedActors: ['ADMIN'] },
  { from: 'DISPUTED', to: 'CANCELLED', allowedActors: ['ADMIN'] },
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
  { from: 'FAILED', to: 'CAPTURED', allowedActors: ['SYSTEM', 'ADMIN'] },
  { from: 'AUTHORIZED', to: 'REFUNDED', allowedActors: ['SYSTEM', 'ADMIN'] },
  { from: 'CAPTURED', to: 'REFUNDED', allowedActors: ['ADMIN', 'SYSTEM'] },
  { from: 'CAPTURED', to: 'RELEASED', allowedActors: ['ADMIN', 'SYSTEM'] },
  // M3: a refund is requested at the gateway first and confirmed by webhook.
  { from: 'CAPTURED', to: 'REFUND_PENDING', allowedActors: ['ADMIN', 'SYSTEM'] },
  { from: 'REFUND_PENDING', to: 'REFUNDED', allowedActors: ['ADMIN', 'SYSTEM'] },
  // refund.failed: the money was never returned, so the payment is captured again.
  { from: 'REFUND_PENDING', to: 'CAPTURED', allowedActors: ['ADMIN', 'SYSTEM'] },
];

/**
 * M3 payment policy: the booking status at which a CAPTURED payment becomes
 * mandatory. 'COMPLETED' = pay-after-service-work (a booking cannot be
 * completed unpaid). Switch to 'IN_PROGRESS' to require payment before work
 * starts; every other code path reads this constant.
 */
export type PaymentRequiredBefore = 'IN_PROGRESS' | 'COMPLETED';
export const PAYMENT_REQUIRED_BEFORE: PaymentRequiredBefore = 'COMPLETED';

const PAID_PAYMENT_STATUSES: readonly PaymentStatus[] = ['CAPTURED', 'RELEASED'];

/** Booking statuses that are gated behind a captured payment under the policy. */
function paymentGatedStatuses(policy: PaymentRequiredBefore): readonly BookingStatus[] {
  return policy === 'IN_PROGRESS' ? ['IN_PROGRESS', 'COMPLETED'] : ['COMPLETED'];
}

/**
 * Throws unless the booking may move to `targetStatus` given its payment.
 * Admins may override with a reason (returned so the caller can audit-log it).
 */
export function assertPaymentSatisfied(input: {
  targetStatus: BookingStatus;
  paymentStatus: PaymentStatus | null | undefined;
  actorRole: ActorRole;
  overrideReason?: string;
  policy?: PaymentRequiredBefore;
}): { overridden: boolean; reason?: string } {
  const gated = paymentGatedStatuses(input.policy ?? PAYMENT_REQUIRED_BEFORE);
  if (!gated.includes(input.targetStatus)) return { overridden: false };
  if (input.paymentStatus && PAID_PAYMENT_STATUSES.includes(input.paymentStatus)) {
    return { overridden: false };
  }
  const reason = input.overrideReason?.trim();
  if (input.actorRole === 'ADMIN' && reason) {
    return { overridden: true, reason };
  }
  throw new ConflictException(
    `Payment must be captured before this booking can move to ${input.targetStatus}` +
      (input.actorRole === 'ADMIN' ? ' (admins may override by providing a reason)' : ''),
  );
}

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
