import * as Sentry from '@sentry/nestjs';
import { scrubSentryEvent, scrubString, scrubValue } from '@weyro/api-contracts';
import { captureServerError } from './sentry';

describe('M9 – Sentry PII scrubbing', () => {
  describe('scrubString', () => {
    it.each([
      ['call +91 98765 43210 now', 'call [phone] now'],
      ['phone 9876543210 failed', 'phone [phone] failed'],
      ['user 09876543210', 'user [phone]'],
      ['+919876543210', '[phone]'],
      ['(987) 654-3210', '[phone]'],
    ])('redacts the phone number in %j', (input, expected) => {
      expect(scrubString(input)).toBe(expected);
    });

    it('redacts JWTs, bearer tokens and secret query parameters', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJpYXQiOjE3MDAwMDAwMDB9.c2lnbmF0dXJlLXNpZ25hdHVyZQ';
      expect(scrubString(`token ${jwt} rejected`)).toBe('token [token] rejected');
      expect(scrubString('Authorization: Bearer abcdef1234567890xyz')).toBe('Authorization: Bearer [token]');
      expect(scrubString('GET /uploads/local-file?key=a/b.jpg&token=1.deadbeef&x=1')).toBe(
        'GET /uploads/local-file?key=[Filtered]&token=[Filtered]&x=1',
      );
    });

    it('redacts labelled OTP codes', () => {
      expect(scrubString('Invalid OTP code 482913')).not.toContain('482913');
      expect(scrubString('otp=482913')).toBe('otp=[code]');
      expect(scrubString('{"code":"482913"}')).not.toContain('482913');
    });

    it('leaves ordinary diagnostics readable', () => {
      for (const text of [
        'Booking #a1b2c3d4 status changed',
        'Prisma error P2002 on POST /api/v1/damage-requests',
        'order_Mt1234567890 amount 450050 INR',
        '2026-11-16T10:00:00.123Z',
        'damage-requests/0b6c1f1e/1700000000000_ab12cd34.jpg',
      ]) {
        expect(scrubString(text)).toBe(text);
      }
    });
  });

  describe('scrubValue / scrubSentryEvent', () => {
    it('replaces the value of any sensitive key, at any depth, without mutating the input', () => {
      const input = {
        phone: '+919876543210',
        user: { otp: '123456', password: 'hunter2', name: 'Asha' },
        headers: { authorization: 'Bearer abcdefgh12345678', 'x-request-id': 'req-1' },
        list: [{ refreshToken: 'abc', ok: 1 }],
      };
      const out = scrubValue(input);
      expect(out.phone).toBe('[Filtered]');
      expect(out.user).toEqual({ otp: '[Filtered]', password: '[Filtered]', name: 'Asha' });
      expect(out.headers).toEqual({ authorization: '[Filtered]', 'x-request-id': 'req-1' });
      expect(out.list[0]).toEqual({ refreshToken: '[Filtered]', ok: 1 });
      expect(input.phone).toBe('+919876543210'); // original untouched
    });

    it('drops request bodies and cookies and reduces the user to an opaque id', () => {
      const event = scrubSentryEvent({
        request: {
          url: 'https://api.weyro.in/api/v1/auth/verify-otp',
          cookies: { sid: 'x' },
          data: { phone: '+919876543210', code: '123456' },
          headers: { authorization: 'Bearer abcdefgh12345678', accept: 'application/json' },
        },
        user: { id: 'user-1', email: 'a@b.in', phone: '+919876543210', ip_address: '1.2.3.4' },
      });
      expect(event.request.data).toBeUndefined();
      expect(event.request.cookies).toBeUndefined();
      expect(event.request.headers).toEqual({ authorization: '[Filtered]', accept: 'application/json' });
      expect(event.user).toEqual({ id: 'user-1' });
    });
  });

  describe('end to end through the real SDK', () => {
    const sent: string[] = [];

    beforeAll(() => {
      // Same options as src/instrument.ts, with a transport that captures instead of sending.
      Sentry.init({
        dsn: 'https://public@example.ingest.sentry.io/1',
        sendDefaultPii: false as never,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          databaseQueryData: false,
          queues: false,
          stackFrameVariables: false,
        },
        beforeSend: (event) => scrubSentryEvent(event as never) as typeof event,
        beforeBreadcrumb: (breadcrumb) => scrubValue(breadcrumb),
        transport: () => ({
          send: async (envelope: unknown) => {
            sent.push(JSON.stringify(envelope));
            return {};
          },
          flush: async () => true,
        }),
      });
    });
    afterAll(async () => {
      await Sentry.close(1000);
    });

    it('a failure full of phone numbers, OTPs and tokens is reported without any of them', async () => {
      Sentry.addBreadcrumb({
        category: 'http',
        message: 'POST /auth/verify-otp phone=+919876543210 otp=482913',
        data: { phone: '+919876543210', url: '/auth/verify-otp?code=482913&phone=9876543210' },
      });
      captureServerError(
        new Error(
          'MSG91 failed for +91 98765 43210 with otp 482913 and Bearer abcdefgh1234567890 / eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl',
        ),
        { requestId: 'req-1', method: 'POST', path: '/api/v1/auth/send-otp?phone=9876543210' },
      );
      await Sentry.flush(1000);

      const payload = sent.join('\n');
      expect(payload).toContain('MSG91 failed'); // the event WAS sent...
      expect(payload).toContain('req-1');
      for (const secret of ['9876543210', '98765 43210', '482913', 'abcdefgh1234567890', 'c2lnbmF0dXJl']) {
        expect(payload).not.toContain(secret); // ...but scrubbed
      }
    });

    it('captureServerError records only the route path, never the query string', async () => {
      sent.length = 0;
      // Built at runtime: Sentry attaches source-code context lines, which would
      // otherwise contain these literals from this very file.
      const secret = ['zz', 'Q9', 'x1'].join('');
      const number = ['98765', '43211'].join('');
      captureServerError(new Error('boom'), {
        requestId: 'req-2',
        path: `/api/v1/users?phone=${number}&token=${secret}`,
      });
      await Sentry.flush(1000);
      const payload = sent.join('\n');
      expect(payload).toContain('"http.path":"/api/v1/users"');
      expect(payload).not.toContain(number);
      expect(payload).not.toContain(secret);
    });
  });

  it('captureServerError is a silent no-op when Sentry is not initialised', async () => {
    // Fresh module registry: no init() has run in this isolated copy.
    await jest.isolateModulesAsync(async () => {
      const { captureServerError: isolated } = await import('./sentry');
      expect(() => isolated(new Error('x'), { requestId: 'r' })).not.toThrow();
    });
  });
});
