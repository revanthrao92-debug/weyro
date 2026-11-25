import { notificationHref } from '../src/lib/notificationHref';

describe('notificationHref (in-app list and push taps)', () => {
  it('sends a customer to the booking and a provider to their quotes on QUOTATION_ACCEPTED', () => {
    const data = { type: 'QUOTATION_ACCEPTED', bookingId: 'b1' };
    expect(notificationHref(data, 'CUSTOMER')).toBe('/booking/b1');
    expect(notificationHref(data, 'PROVIDER')).toBe('/my-quotes');
  });

  it('opens a new nearby request for the garage so it can quote', () => {
    expect(notificationHref({ type: 'new_request', requestId: 'r9' }, 'PROVIDER')).toBe('/requests/r9');
  });

  it('prefers an explicit route and ignores empty payloads', () => {
    expect(notificationHref({ route: '/sos' }, 'CUSTOMER')).toBe('/sos');
    expect(notificationHref(null, 'CUSTOMER')).toBeNull();
    expect(notificationHref({}, 'CUSTOMER')).toBeNull();
  });
});
