import { canTransitionDriverJob, type DriverJobStatus } from './driver-state';

describe('Driver Go job state machine', () => {
  it('allows the happy path and blocks skipped states', () => {
    expect(canTransitionDriverJob('REQUESTED', 'CONFIRMED')).toBe(true);
    expect(canTransitionDriverJob('CONFIRMED', 'DRIVER_EN_ROUTE')).toBe(true);
    expect(canTransitionDriverJob('DRIVER_EN_ROUTE', 'ARRIVED')).toBe(true);
    expect(canTransitionDriverJob('ARRIVED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionDriverJob('IN_PROGRESS', 'COMPLETED')).toBe(true);

    expect(canTransitionDriverJob('REQUESTED', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionDriverJob('CONFIRMED', 'COMPLETED')).toBe(false);
    expect(canTransitionDriverJob('COMPLETED', 'IN_PROGRESS')).toBe(false);
  });

  it('allows cancellation before the trip starts and disputes during it', () => {
    expect(canTransitionDriverJob('REQUESTED', 'CANCELLED')).toBe(true);
    expect(canTransitionDriverJob('CONFIRMED', 'CANCELLED')).toBe(true);
    expect(canTransitionDriverJob('DRIVER_EN_ROUTE', 'CANCELLED')).toBe(true);
    expect(canTransitionDriverJob('ARRIVED', 'CANCELLED')).toBe(true);
    expect(canTransitionDriverJob('IN_PROGRESS', 'DISPUTED')).toBe(true);
    expect(canTransitionDriverJob('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('has no transitions out of terminal states', () => {
    (['COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'] as DriverJobStatus[]).forEach(
      (status) => {
        expect(canTransitionDriverJob(status, 'CONFIRMED')).toBe(false);
        expect(canTransitionDriverJob(status, 'IN_PROGRESS')).toBe(false);
      },
    );
  });
});
