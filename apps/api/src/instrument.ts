/**
 * M9: Sentry bootstrap. MUST be the first import in main.ts so the SDK can
 * instrument everything loaded after it. A missing SENTRY_DSN means "off":
 * nothing is initialised and no network calls are made.
 */
import * as Sentry from '@sentry/nestjs';
import { scrubSentryEvent, scrubValue } from '@weyro/api-contracts';

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    // Sentry 11 collects headers, cookies, bodies, query params, DB query
    // parameters and local variable values BY DEFAULT. Every one of those can
    // carry a phone number, OTP or token, so all of them are switched off.
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
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0) || 0,
    // Phone numbers, OTPs and tokens are scrubbed from every event and breadcrumb.
    beforeSend: (event) => scrubSentryEvent(event as never) as typeof event,
    beforeBreadcrumb: (breadcrumb) => scrubValue(breadcrumb),
  });
}
