import { bookingStatusTone, labelize, titleize } from '../src/utils/format';

describe('titleize', () => {
  it('replaces every underscore, not just the first', () => {
    expect(titleize('PROVIDER_EN_ROUTE')).toBe('Provider en route');
    expect(titleize('HELD_IN_ESCROW')).toBe('Held in escrow');
  });

  it('labelize uses the same sentence case', () => {
    expect(labelize('QUOTES_RECEIVED')).toBe('Quotes received');
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

describe('formatRupees (the one rupee format)', () => {
  const { formatRupees } = require('../src/utils/format');
  it('whole rupees: no decimals, Indian grouping', () => {
    expect(formatRupees(749)).toBe('₹749');
    expect(formatRupees(413077)).toBe('₹4,13,077');
  });
  it('paise are shown with two digits, never rounded away', () => {
    expect(formatRupees('1899.5')).toBe('₹1,899.50');
    expect(formatRupees(1899.999)).toBe('₹1,900');
  });
  it('missing or bad values read as ₹0', () => {
    expect(formatRupees(null)).toBe('₹0');
    expect(formatRupees(undefined)).toBe('₹0');
    expect(formatRupees('abc')).toBe('₹0');
  });
});
