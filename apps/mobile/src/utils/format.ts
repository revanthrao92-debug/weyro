import { StatusTone } from '@/theme';

/**
 * Shared formatting helpers.
 *
 * L1: consolidated from ~12 per-screen copies. Three distinct `labelize`
 * behaviors existed across screens — kept as three explicitly named helpers
 * (behavior is NOT silently unified — diffs stay intentional):
 *
 *   - `labelize`    : 'QUOTES_RECEIVED' → 'Quotes Received' (title-case words)
 *   - `humanizeKey` : 'QUOTES_RECEIVED' → 'quotes received' (space, low-key)
 *   - `titleize`    : 'QUOTES_RECEIVED' → 'Quotes received' (first-upper)
 *
 * Plus domain status-tone maps. All behavior is verbatim from originals.
 */

/** 'QUOTES_RECEIVED' → 'Quotes Received' */
export function labelize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/** 'QUOTES_RECEIVED' → 'quotes received' */
export function humanizeKey(s: string): string {
  return s.replace(/_/g, ' ');
}

/** 'QUOTES_RECEIVED' → 'Quotes received' */
export function titleize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace('_', ' ');
}

/** 'SPARE_PART' → 'Spare_part' (original listings variant: case only, keeps underscores) */
export function plainTitleize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** '2026-10-31T…' → '31 Oct 2026' */
export function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Booking status tones (booking/[id], bookings list). */
export function bookingStatusTone(status: string): StatusTone {
  switch (status) {
    case 'CONFIRMED':
    case 'PROVIDER_EN_ROUTE':
    case 'IN_PROGRESS':
      return 'info';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    case 'DISPUTED':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Quotation status tones (my-quotes). */
export function quotationStatusTone(status: string): StatusTone {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'danger';
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Service-request status tones (requests/[id], home). */
export function requestStatusTone(status: string): StatusTone {
  switch (status) {
    case 'OPEN':
    case 'QUOTES_RECEIVED':
      return 'info';
    case 'ACCEPTED':
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}
