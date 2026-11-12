import { canTransitionFulfillment } from './fulfillment-state';

describe('fulfillment state machine', () => {
  it('walks the happy path in order', () => {
    expect(canTransitionFulfillment('PENDING', 'PROCESSING')).toBe(true);
    expect(canTransitionFulfillment('PROCESSING', 'READY')).toBe(true);
    expect(canTransitionFulfillment('PROCESSING', 'SHIPPED')).toBe(true);
    expect(canTransitionFulfillment('READY', 'SHIPPED')).toBe(true);
    expect(canTransitionFulfillment('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('rejects skipping backwards or past delivery', () => {
    expect(canTransitionFulfillment('PENDING', 'SHIPPED')).toBe(false);
    expect(canTransitionFulfillment('READY', 'PROCESSING')).toBe(false);
    expect(canTransitionFulfillment('DELIVERED', 'SHIPPED')).toBe(false);
    expect(canTransitionFulfillment('PENDING', 'DELIVERED')).toBe(false);
  });
});
