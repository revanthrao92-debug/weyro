/**
 * Plain-language timeline lines for the admin record screen, built from the event history.
 * Who acted is implied by the step itself ("Customer paid", "Dealer marked shipped").
 */

export type TimelineEvent = {
  occurredAt: Date;
  type: string;
  entityType: string;
  entityRef: string;
  fromStatus: string | null;
  toStatus: string | null;
  source: string;
  data: unknown;
};

export type TimelineLine = { at: string; text: string; ref: string; tone: 'done' | 'problem' | 'neutral' };

const rupees = (v: unknown) =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? '' : ` ₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STEPS: Record<string, Record<string, string>> = {
  Request: {
    OPEN: 'Request open for quotes',
    QUOTES_RECEIVED: 'Quotes received',
    ACCEPTED: 'Customer accepted a quote',
    IN_PROGRESS: 'Work in progress',
    COMPLETED: 'Request completed',
    CANCELLED: 'Request cancelled',
    EXPIRED: 'Request expired with no quote accepted',
    DRAFT: 'Request saved as a draft',
  },
  Quote: {
    PENDING: 'Quote waiting for the customer',
    ACCEPTED: 'Customer accepted the quote',
    REJECTED: 'Customer chose another quote',
    EXPIRED: 'Quote expired',
    WITHDRAWN: 'Provider withdrew the quote',
  },
  Job: {
    CONFIRMED: 'Job confirmed',
    PROVIDER_EN_ROUTE: 'Provider on the way',
    IN_PROGRESS: 'Work started',
    COMPLETED: 'Job completed',
    CANCELLED: 'Job cancelled',
    DISPUTED: 'Issue reported',
  },
  PartsOrder: {
    PENDING: 'Waiting for the customer to pay',
    PAID: 'Customer paid',
    CANCELLED: 'Order cancelled',
    FAILED: 'Payment failed',
    REFUNDED: 'Money refunded to the customer',
  },
  PartsDelivery: {
    PENDING: 'Waiting for the dealer',
    PROCESSING: 'Dealer started packing',
    READY: 'Ready for pickup',
    SHIPPED: 'Dealer marked it shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Delivery cancelled',
  },
  DriverTrip: {
    REQUESTED: 'Trip requested',
    CONFIRMED: 'Driver accepted',
    DRIVER_EN_ROUTE: 'Driver on the way',
    ARRIVED: 'Driver arrived at pickup',
    IN_PROGRESS: 'Trip started with the customer\'s code',
    COMPLETED: 'Trip completed',
    CANCELLED: 'Trip cancelled',
    EXPIRED: 'Request expired, no driver accepted',
    DISPUTED: 'Issue reported',
  },
  Payment: {
    PENDING: 'Payment started',
    AUTHORIZED: 'Payment approved by the bank',
    CAPTURED: 'Payment received',
    RELEASED: 'Paid out to the provider',
    REFUND_PENDING: 'Refund in progress',
    REFUNDED: 'Payment refunded',
    FAILED: 'Payment failed',
  },
  Refund: {
    PENDING: 'Refund started',
    PROCESSED: 'Refund completed',
    FAILED: 'Refund failed',
  },
};

const CREATED: Record<string, (d: Record<string, unknown>) => string> = {
  Request: () => 'Customer posted the request',
  Quote: (d) => `Quote sent:${rupees(d.totalCost)}`,
  Job: () => 'Job booked',
  PartsOrder: (d) => `Order placed: ${d.quantity ?? 1} × ${d.partName ?? 'part'},${rupees(d.totalAmount)}`,
  DriverTrip: (d) => `Trip requested:${rupees(d.totalAmount)}`,
  Payment: (d) => `Payment started:${rupees(d.amount)}`,
  Refund: (d) => `Refund started:${rupees(d.amount)}`,
};

const PROBLEMS = new Set(['CANCELLED', 'DISPUTED', 'FAILED', 'EXPIRED', 'REFUNDED', 'WITHDRAWN', 'REJECTED']);

/**
 * One readable line per event; text events (training data) are left out of the timeline.
 * `base` is the record's own "created" data: history rebuilt from old timestamps has no amounts,
 * so a later step like "Customer paid" borrows the amount from there.
 */
export function timelineLine(e: TimelineEvent, base: Record<string, unknown> = {}): TimelineLine | null {
  if (e.type === 'text') return null;
  const data = { ...base, ...((e.data ?? {}) as Record<string, unknown>) };
  let text: string;
  if (e.type === 'created') {
    text = (CREATED[e.entityType] ?? (() => `${e.entityType} created`))(data);
  } else {
    const table = e.type === 'fulfillment_changed' ? STEPS.PartsDelivery : STEPS[e.entityType];
    text = table?.[e.toStatus ?? ''] ?? `Status changed to ${(e.toStatus ?? 'unknown').toLowerCase().replace(/_/g, ' ')}`;
    if (e.entityType === 'PartsOrder' && e.toStatus === 'PAID') text += rupees(data.totalAmount);
    if (e.entityType === 'Payment' && (e.toStatus === 'CAPTURED' || e.toStatus === 'RELEASED')) text += rupees(data.amount);
  }
  const tone = e.toStatus && PROBLEMS.has(e.toStatus) ? 'problem' : e.type === 'created' ? 'neutral' : 'done';
  return { at: e.occurredAt.toISOString(), text: text.replace(/[:,]$/, ''), ref: e.entityRef, tone };
}

/** All timeline lines, oldest first. */
export function buildTimeline(events: TimelineEvent[]): TimelineLine[] {
  const created = new Map<string, Record<string, unknown>>();
  for (const e of events) if (e.type === 'created') created.set(e.entityRef, (e.data ?? {}) as Record<string, unknown>);
  return [...events]
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((e) => timelineLine(e, created.get(e.entityRef)))
    .filter((line): line is TimelineLine => line !== null);
}
