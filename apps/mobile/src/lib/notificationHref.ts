/** Where a notification (in-app list or push tap) should take the user. */
export function notificationHref(
  data: Record<string, unknown> | null,
  role?: string | null,
): string | null {
  if (!data) return null;
  if (typeof data.route === 'string') return data.route;

  if (typeof data.orderId === 'string') return `/order/${data.orderId}`;
  if (typeof data.requestId === 'string') {
    return role === 'CUSTOMER' ? `/requests/${data.requestId}` : '/my-quotes';
  }
  if (typeof data.driverBookingId === 'string') {
    return role === 'CUSTOMER'
      ? `/driver-go/bookings/${data.driverBookingId}`
      : `/driver-booking/${data.driverBookingId}`;
  }
  if (typeof data.bookingId === 'string') {
    if (data.type === 'QUOTATION_ACCEPTED' && role !== 'CUSTOMER') {
      return '/my-quotes';
    }
    return `/booking/${data.bookingId}`;
  }
  if (data.type === 'QUOTATION_ACCEPTED') {
    return role === 'CUSTOMER' ? '/bookings' : '/my-quotes';
  }
  return null;
}
