/* eslint-env jest */
import {
  labelize,
  humanizeKey,
  titleize,
  plainTitleize,
  formatDate,
  bookingStatusTone,
  quotationStatusTone,
  requestStatusTone,
} from '../src/utils/format';

describe('format utils (L1 consolidation)', () => {
  it('labelize: title-cases underscore words', () => {
    expect(labelize('QUOTES_RECEIVED')).toBe('Quotes Received');
    expect(labelize('OPEN')).toBe('Open');
  });

  it('humanizeKey: underscores → spaces (case preserved, per original)', () => {
    expect(humanizeKey('PROVIDER_EN_ROUTE')).toBe('PROVIDER EN ROUTE');
  });

  it('titleize: first-upper, rest-lower, underscores spaced', () => {
    expect(titleize('QUOTES_RECEIVED')).toBe('Quotes received');
  });

  it('plainTitleize: case only, keeps underscores (legacy listings variant)', () => {
    expect(plainTitleize('SPARE_PART')).toBe('Spare_part');
  });

  it('formatDate returns empty string for falsy input', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
  });

  it('booked/booking statuses map to stable tones', () => {
    expect(bookingStatusTone('IN_PROGRESS')).toBe('info');
    expect(bookingStatusTone('COMPLETED')).toBe('success');
    expect(bookingStatusTone('CANCELLED')).toBe('danger');
    expect(bookingStatusTone('DISPUTED')).toBe('warning');
  });

  it('quotation statuses map to stable tones', () => {
    expect(quotationStatusTone('PENDING')).toBe('warning');
    expect(quotationStatusTone('ACCEPTED')).toBe('success');
    expect(quotationStatusTone('WITHDRAWN')).toBe('danger');
  });

  it('request statuses map to stable tones', () => {
    expect(requestStatusTone('QUOTES_RECEIVED')).toBe('info');
    expect(requestStatusTone('ACCEPTED')).toBe('success');
  });
});
