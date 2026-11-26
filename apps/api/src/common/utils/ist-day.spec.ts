import { istDayStart, istMonthStart, istWeekStart } from './ist-day';

describe('Indian-calendar day boundaries', () => {
  it('01:00 IST on Wed 26 Nov is still 26 Nov (UTC says 25 Nov 19:30)', () => {
    const oneAmIst = new Date('2026-11-25T19:30:00.000Z');
    expect(istDayStart(oneAmIst).toISOString()).toBe('2026-11-25T18:30:00.000Z'); // 26 Nov 00:00 IST
  });

  it('just before midnight IST stays on the same day', () => {
    expect(istDayStart(new Date('2026-11-26T18:29:00.000Z')).toISOString()).toBe('2026-11-25T18:30:00.000Z');
    expect(istDayStart(new Date('2026-11-26T18:30:00.000Z')).toISOString()).toBe('2026-11-26T18:30:00.000Z');
  });

  it('week starts Sunday midnight IST', () => {
    // Wed 26 Nov 2026, 01:00 IST -> Sunday 22 Nov 00:00 IST
    expect(istWeekStart(new Date('2026-11-25T19:30:00.000Z')).toISOString()).toBe('2026-11-21T18:30:00.000Z');
  });

  it('month starts on the 1st midnight IST, even in the first hours of the month', () => {
    // 1 Dec 02:00 IST is 30 Nov in UTC
    expect(istMonthStart(new Date('2026-11-30T20:30:00.000Z')).toISOString()).toBe('2026-11-30T18:30:00.000Z');
  });
});
