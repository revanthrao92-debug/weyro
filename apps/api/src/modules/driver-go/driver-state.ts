export type DriverJobStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'DRIVER_EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'DISPUTED';

const DRIVER_TRANSITIONS: Record<DriverJobStatus, DriverJobStatus[]> = {
  REQUESTED: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['DRIVER_EN_ROUTE', 'CANCELLED'],
  DRIVER_EN_ROUTE: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  DISPUTED: [],
};

export function canTransitionDriverJob(
  from: DriverJobStatus,
  to: DriverJobStatus,
): boolean {
  return DRIVER_TRANSITIONS[from]?.includes(to) ?? false;
}
