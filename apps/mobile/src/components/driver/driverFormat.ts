import type { StatusTone } from '@/theme';
import type { DriverJob } from '@/hooks/useDriverGo';
import { formatDate } from '@/utils/format';

export function money(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export function jobWhen(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const time = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (sameDay(date, today)) return `Today, ${time}`;
  if (sameDay(date, tomorrow)) return `Tomorrow, ${time}`;
  return `${formatDate(iso)}, ${time}`;
}

export function durationLabel(job: DriverJob): string {
  if (job.engagement === 'DAILY') {
    const days = job.durationDays ?? 1;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  const hours = job.durationHours ?? 1;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function jobStatusLabel(status: DriverJob['status']): string {
  switch (status) {
    case 'REQUESTED':
      return 'New request';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'DRIVER_EN_ROUTE':
      return 'En route';
    case 'ARRIVED':
      return 'Arrived';
    case 'IN_PROGRESS':
      return 'In progress';
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

export function jobStatusTone(status: DriverJob['status']): StatusTone {
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

export function customerName(job: DriverJob): string {
  return [job.customer.firstName, job.customer.lastName]
    .filter(Boolean)
    .join(' ');
}

export function vehicleLabel(job: DriverJob): string {
  if (!job.vehicle) return 'Vehicle';
  return `${job.vehicle.make} ${job.vehicle.model} · ${job.vehicle.registrationNumber}`;
}
