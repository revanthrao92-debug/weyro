import { calculateDriverFare, driverBookingEnd } from './driver-pricing';

describe('Driver Go fare', () => {
  const startAt = new Date('2026-11-13T04:30:00.000Z'); // 10:00 IST

  it('prices hourly work and the platform commission', () => {
    const fare = calculateDriverFare({
      engagement: 'HOURLY',
      hourlyRate: 299,
      dailyRate: 1799,
      durationHours: 2,
      startAt,
    });
    expect(fare.totalAmount).toBe(598);
    expect(fare.platformFee).toBe(107.64);
    expect(fare.driverEarning).toBe(490.36);
    expect(fare.endAt.toISOString()).toBe('2026-11-13T06:30:00.000Z');
  });

  it('prices a daily booking as an 8-hour day', () => {
    const fare = calculateDriverFare({
      engagement: 'DAILY',
      hourlyRate: 299,
      dailyRate: 1799,
      durationDays: 1,
      startAt,
    });
    expect(fare.totalAmount).toBe(1799);
    expect(fare.driverEarning).toBe(1475.18);
    expect(fare.endAt.toISOString()).toBe('2026-11-13T12:30:00.000Z');
  });

  it('adds the 15% night surcharge in IST', () => {
    const night = new Date('2026-11-13T17:30:00.000Z'); // 23:00 IST
    const fare = calculateDriverFare({
      engagement: 'HOURLY',
      hourlyRate: 300,
      dailyRate: 1800,
      durationHours: 2,
      startAt: night,
    });
    expect(fare.totalAmount).toBe(690);
  });

  it('derives the end time from the engagement', () => {
    expect(
      driverBookingEnd('HOURLY', startAt, 4).toISOString(),
    ).toBe('2026-11-13T08:30:00.000Z');
    expect(
      driverBookingEnd('DAILY', startAt, undefined, 1).toISOString(),
    ).toBe('2026-11-13T12:30:00.000Z');
  });
});
