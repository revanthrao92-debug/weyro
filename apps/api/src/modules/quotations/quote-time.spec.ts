import { BadRequestException } from '@nestjs/common';
import { quoteTiming, quotesCloseAt } from './quote-time';

// Mon 25 Nov 2026, 10:00 in India.
const now = new Date('2026-11-25T04:30:00.000Z');

describe('quote time', () => {
  it('writes plain text from start + duration, in Indian dates', () => {
    const t = quoteTiming('2026-11-26T03:30:00.000Z', 48, now); // Thu 9:00 IST, 2 days
    expect(t.durationHours).toBe(48);
    expect(t.etaDescription).toBe('Can start Thu, 26 Nov, takes about 2 days (ready by Sat, 28 Nov)');
  });

  it('says hours for short jobs and "1 week" for 168 hours', () => {
    expect(quoteTiming(now.toISOString(), 4, now).etaDescription).toContain('takes about 4 hours');
    expect(quoteTiming(now.toISOString(), 168, now).etaDescription).toContain('takes about 1 week');
  });

  it('allows "today" picked earlier this morning, but not yesterday or a month out', () => {
    expect(() => quoteTiming('2026-11-25T00:00:00.000Z', 2, now)).not.toThrow();
    expect(() => quoteTiming('2026-11-24T04:00:00.000Z', 2, now)).toThrow(BadRequestException);
    expect(() => quoteTiming('2026-12-30T04:00:00.000Z', 2, now)).toThrow(BadRequestException);
    expect(() => quoteTiming('not a date', 2, now)).toThrow(BadRequestException);
  });

  it('closes quotes at quotesUntil, or at expiresAt for older requests', () => {
    const expiresAt = new Date('2026-12-02T00:00:00Z');
    const quotesUntil = new Date('2026-11-26T00:00:00Z');
    expect(quotesCloseAt({ quotesUntil, expiresAt })).toBe(quotesUntil);
    expect(quotesCloseAt({ quotesUntil: null, expiresAt })).toBe(expiresAt);
  });
});
