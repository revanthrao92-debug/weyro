import type { DriverAvailability } from '@prisma/client';

const IST = 'Asia/Kolkata';

export type LocalTime = {
  weekday: number;
  minutes: number;
};

/** Weekday/minute in Hyderabad local time (driver availability is IST). */
export function istTime(date: Date): LocalTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: IST,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekdayLabel = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    weekday: weekdays.indexOf(weekdayLabel),
    minutes: hour * 60 + minute,
  };
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** A booking window must fit inside one recurring availability block. */
export function windowFitsAvailability(
  rules: DriverAvailability[],
  startAt: Date,
  endAt: Date,
): boolean {
  if (rules.length === 0) return false;
  const start = istTime(startAt);
  const end = istTime(endAt);
  if (start.weekday !== end.weekday || end.minutes <= start.minutes) {
    return false;
  }
  return rules.some(
    (rule) =>
      rule.weekday === start.weekday &&
      rule.startMinute <= start.minutes &&
      rule.endMinute >= end.minutes,
  );
}
