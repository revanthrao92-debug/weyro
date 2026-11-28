import { BadRequestException } from '@nestjs/common';

const HOUR_MS = 3_600_000;
const IST = 'Asia/Kolkata';

/** New quotes stop at quotesUntil; old requests without it fall back to expiresAt. */
export function quotesCloseAt(request: { quotesUntil: Date | null; expiresAt: Date }): Date {
  return request.quotesUntil ?? request.expiresAt;
}

function day(date: Date) {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST });
}

function length(hours: number) {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return days === 7 ? '1 week' : `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Turn the provider's "can start" + "takes about" picks into stored values and the plain text
 * older app versions show. Start may be slightly in the past ("today" picked this morning) but not
 * yesterday, and not more than 30 days ahead.
 */
export function quoteTiming(startsAtIso: string, durationHours: number, now = new Date()) {
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Start time is not a valid date');
  if (startsAt.getTime() < now.getTime() - 12 * HOUR_MS) {
    throw new BadRequestException('Start time is in the past');
  }
  if (startsAt.getTime() > now.getTime() + 30 * 24 * HOUR_MS) {
    throw new BadRequestException('Start time must be within 30 days');
  }
  const readyBy = new Date(startsAt.getTime() + durationHours * HOUR_MS);
  return {
    startsAt,
    durationHours,
    etaDescription: `Can start ${day(startsAt)}, takes about ${length(durationHours)} (ready by ${day(readyBy)})`,
  };
}
