import type { StatusTone } from '@/theme';
import type { CustomerDriverBooking } from '@/hooks/useDriverGoCustomer';

/** Customer-facing status copy (the API statuses are driver-centric). */
export function customerStatusLabel(
  status: CustomerDriverBooking['status'],
): string {
  switch (status) {
    case 'REQUESTED':
      return 'Awaiting driver';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'DRIVER_EN_ROUTE':
      return 'Driver on the way';
    case 'ARRIVED':
      return 'Driver arrived';
    case 'IN_PROGRESS':
      return 'Trip in progress';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'EXPIRED':
      return 'Expired';
    case 'DISPUTED':
      return 'Disputed';
  }
}

export function customerStatusTone(
  status: CustomerDriverBooking['status'],
): StatusTone {
  switch (status) {
    case 'REQUESTED':
      return 'warning';
    case 'CONFIRMED':
    case 'DRIVER_EN_ROUTE':
    case 'ARRIVED':
    case 'IN_PROGRESS':
      return 'info';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    case 'DISPUTED':
      return 'warning';
  }
}
