import { actionLabel, whenShort } from '../src/components/admin/activityFormat';

describe('admin activity wording', () => {
  it('known codes read as plain sentences', () => {
    expect(actionLabel('payment.reconcile')).toBe('Payment checked with the bank');
    expect(actionLabel('provider.verify')).toBe('Provider review decision');
  });

  it('unknown codes still become words, never raw codes', () => {
    expect(actionLabel('booking.status_changed')).toBe('Booking status changed');
    expect(actionLabel('')).toBe('Activity');
  });

  it('times: just the time today, the date before that', () => {
    // Built from local date parts, so this holds in any time zone (CI runs in UTC).
    const now = new Date(2026, 10, 27, 12, 0);
    expect(whenShort(new Date(2026, 10, 27, 10, 42).toISOString(), now)).toBe('10:42');
    expect(whenShort(new Date(2026, 10, 25, 10, 42).toISOString(), now)).toBe('25 Nov, 10:42');
  });
});
