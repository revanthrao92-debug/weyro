import * as Sentry from '@sentry/react-native';
import { scrubSentryEvent, scrubValue } from '@weyro/api-contracts';

/**
 * M9: crash reporting. Off unless EXPO_PUBLIC_SENTRY_DSN is set (so local dev
 * and CI never report). Phone numbers, OTPs and tokens are scrubbed from every
 * event and breadcrumb before they leave the device.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

let initialised = false;

export function initSentry(): boolean {
  if (!dsn || initialised) return initialised;
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production'),
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    // No IPs, cookies or user identity on our behalf, and no screenshots or view
    // hierarchies (they can show phone numbers / OTP codes on screen).
    sendDefaultPii: false,
    reportAccessibilityIdentifier: false,
    enableCaptureFailedRequests: false,
    beforeSend: (event) => scrubSentryEvent(event as never) as typeof event,
    beforeBreadcrumb: (breadcrumb) => scrubValue(breadcrumb),
  });
  initialised = true;
  return true;
}

/** Report a handled error (e.g. from an error boundary). No-op when Sentry is off. */
export function captureError(error: unknown, context?: Record<string, string>): void {
  if (!initialised) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context ?? {})) scope.setTag(key, value);
    Sentry.captureException(error);
  });
}
