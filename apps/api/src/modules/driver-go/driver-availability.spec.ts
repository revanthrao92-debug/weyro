import type { DriverAvailability } from '@prisma/client';
import {
  rangesOverlap,
  windowFitsAvailability,
} from './driver-availability';

function rule(weekday: number, startMinute: number, endMinute: number) {
  return {
    id: 'r',
    driverId: 'd',
    weekday,
    startMinute,
    endMinute,
    createdAt: new Date(),
  } as DriverAvailability;
}

describe('Driver Go availability', () => {
  // 2026-11-13 is a Friday (weekday 5).
  const window = (start: string, end: string) => [
    new Date(start),
    new Date(end),
  ] as const;

  it('accepts a window inside the weekly block', () => {
    const [start, end] = window(
      '2026-11-13T04:30:00.000Z',
      '2026-11-13T08:30:00.000Z',
    );
    expect(windowFitsAvailability([rule(5, 480, 1200)], start, end)).toBe(true);
  });

  it('rejects a window outside the block or with no rules', () => {
    const [start, end] = window(
      '2026-11-13T00:30:00.000Z',
      '2026-11-13T02:00:00.000Z',
    );
    expect(windowFitsAvailability([rule(5, 480, 1200)], start, end)).toBe(false);
    expect(windowFitsAvailability([], start, end)).toBe(false);
  });

  it('rejects a window crossing midnight', () => {
    const [start, end] = window(
      '2026-11-13T14:30:00.000Z',
      '2026-11-13T18:30:00.000Z',
    );
    expect(windowFitsAvailability([rule(5, 480, 1200)], start, end)).toBe(false);
  });

  it('detects overlapping bookings', () => {
    const a = new Date('2026-11-13T04:30:00.000Z');
    const b = new Date('2026-11-13T08:30:00.000Z');
    expect(
      rangesOverlap(a, b, new Date('2026-11-13T05:00:00.000Z'), new Date('2026-11-13T06:00:00.000Z')),
    ).toBe(true);
    expect(
      rangesOverlap(a, b, new Date('2026-11-13T09:00:00.000Z'), new Date('2026-11-13T10:00:00.000Z')),
    ).toBe(false);
  });
});
