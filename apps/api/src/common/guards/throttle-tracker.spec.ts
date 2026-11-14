import { describe, it, expect } from '@jest/globals';
import { requestThrottleTracker } from './throttle-tracker';

describe('requestThrottleTracker', () => {
  it('limits authenticated calls per user', () => {
    expect(
      requestThrottleTracker({ user: { sub: 'user-1' }, ip: '10.0.0.1' }),
    ).toBe('user:user-1');
  });

  it('falls back to the IP for public routes', () => {
    expect(requestThrottleTracker({ ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });

  it('never returns an empty key', () => {
    expect(requestThrottleTracker({})).toBe('ip:unknown');
  });
});
