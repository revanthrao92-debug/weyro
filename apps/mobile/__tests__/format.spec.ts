import { bookingStatusTone, titleize } from '../src/utils/format';

describe('titleize', () => {
  it('replaces every underscore, not just the first', () => {
    expect(titleize('PROVIDER_EN_ROUTE')).toBe('Provider en route');
    expect(titleize('HELD_IN_ESCROW')).toBe('Held in escrow');
  });
});

describe('bookingStatusTone', () => {
  it('gives each job stage its own tone', () => {
    expect(bookingStatusTone('CONFIRMED')).toBe('info');
    expect(bookingStatusTone('PROVIDER_EN_ROUTE')).toBe('info');
    expect(bookingStatusTone('IN_PROGRESS')).toBe('progress');
    expect(bookingStatusTone('COMPLETED')).toBe('success');
    expect(bookingStatusTone('DISPUTED')).toBe('danger');
    expect(bookingStatusTone('CANCELLED')).toBe('danger');
  });
});
