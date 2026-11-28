import { bookingUpdateMessage } from './booking-messages';

const msg = (status: string, extra: Partial<Parameters<typeof bookingUpdateMessage>[0]> = {}) =>
  bookingUpdateMessage({ status, jobTitle: 'Front bumper dent', providerName: 'Koramangala Motors', audience: 'customer', ...extra });

describe('booking update alerts', () => {
  it('speaks plainly to the customer at each step, never a system code', () => {
    expect(msg('PROVIDER_EN_ROUTE')).toEqual({ title: 'On the way', body: 'Koramangala Motors is on the way for "Front bumper dent".' });
    expect(msg('IN_PROGRESS').title).toBe('Work started');
    expect(msg('COMPLETED')).toEqual({
      title: 'Job completed',
      body: 'Koramangala Motors has completed "Front bumper dent". Please rate your experience.',
    });
    for (const s of ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED']) {
      const m = msg(s);
      expect(`${m.title} ${m.body}`).not.toMatch(/[A-Z]{3,}_|[A-Z]{6,}/);
    }
  });

  it('uses parts and towing words where they fit', () => {
    expect(msg('IN_PROGRESS', { category: 'SPARE_PART' }).title).toBe('Order being packed');
    expect(msg('COMPLETED', { category: 'SPARE_PART' }).title).toBe('Order delivered');
    expect(msg('IN_PROGRESS', { category: 'TOWING' }).title).toBe('Towing started');
  });

  it('tells the provider when the customer cancels or reports an issue', () => {
    expect(msg('CANCELLED', { audience: 'provider' })).toEqual({ title: 'Booking cancelled', body: 'The customer cancelled "Front bumper dent".' });
    expect(msg('DISPUTED', { audience: 'provider' }).title).toBe('Issue reported');
  });
});

describe('job alerts carry the reference number', () => {
  const base = { status: 'PROVIDER_EN_ROUTE', jobTitle: 'Front bumper dent', providerName: 'Apex Auto', audience: 'customer' as const };

  it('ends with the job number when there is one', () => {
    expect(bookingUpdateMessage({ ...base, ref: 'J-261127-0042-6' }).body).toBe(
      'Apex Auto is on the way for "Front bumper dent". Ref J-261127-0042-6.',
    );
  });

  it('reads normally without one', () => {
    expect(bookingUpdateMessage(base).body).toBe('Apex Auto is on the way for "Front bumper dent".');
  });
});
