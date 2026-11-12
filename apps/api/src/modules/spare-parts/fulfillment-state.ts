export type FulfillmentState =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

const TRANSITIONS: Record<FulfillmentState, FulfillmentState[]> = {
  PENDING: ['PROCESSING'],
  PROCESSING: ['READY', 'SHIPPED'],
  READY: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionFulfillment(
  from: FulfillmentState,
  to: FulfillmentState,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
