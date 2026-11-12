import { istTime } from './driver-availability';

export type DriverFareInput = {
  engagement: 'HOURLY' | 'DAILY';
  hourlyRate: number;
  dailyRate: number;
  durationHours?: number;
  durationDays?: number;
  startAt: Date;
};

export type DriverFare = {
  baseAmount: number;
  platformFee: number;
  totalAmount: number;
  driverEarning: number;
  endAt: Date;
};

const PLATFORM_COMMISSION = 0.18;
const NIGHT_SURCHARGE = 0.15;
const DAILY_HOURS = 8;

export function driverBookingEnd(
  engagement: 'HOURLY' | 'DAILY',
  startAt: Date,
  durationHours?: number,
  durationDays?: number,
): Date {
  if (engagement === 'HOURLY') {
    return new Date(
      startAt.getTime() + (durationHours ?? 2) * 60 * 60 * 1000,
    );
  }
  return new Date(
    startAt.getTime() + (durationDays ?? 1) * DAILY_HOURS * 60 * 60 * 1000,
  );
}

export function calculateDriverFare(input: DriverFareInput): DriverFare {
  const startAt = input.startAt;
  const endAt = driverBookingEnd(
    input.engagement,
    startAt,
    input.durationHours,
    input.durationDays,
  );
  const base =
    input.engagement === 'HOURLY'
      ? input.hourlyRate * (input.durationHours ?? 2)
      : input.dailyRate * (input.durationDays ?? 1);

  const minutes = istTime(startAt).minutes;
  const night =
    minutes >= 22 * 60 || minutes < 6 * 60 ? base * NIGHT_SURCHARGE : 0;
  const total = round2(base + night);
  const platformFee = round2(total * PLATFORM_COMMISSION);

  return {
    baseAmount: total,
    platformFee,
    totalAmount: total,
    driverEarning: round2(total - platformFee),
    endAt,
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
