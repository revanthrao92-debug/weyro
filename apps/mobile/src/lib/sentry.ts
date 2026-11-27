import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import { scrubSentryEvent, scrubValue } from '@weyro/api-contracts';

/**
 * M9: crash reporting. Off unless EXPO_PUBLIC_SENTRY_DSN is set (so local dev
 * and CI never report). Phone numbers, OTPs and tokens are scrubbed from every
 * event and breadcrumb before they leave the device.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

let initialised = false;

type UpdateInfo = Pick<typeof Updates, 'updateId' | 'isEmbeddedLaunch' | 'channel' | 'runtimeVersion'>;

/**
 * Which app code a crash came from: the over-the-air update id, or "embedded" for the code
 * shipped in the store build. Lets us undo exactly the update that is crashing.
 * Empty in development and on web, where updates are off.
 */
export function updateTags(u: UpdateInfo): Record<string, string> {
  if (!u.updateId) return {};
  const tags: Record<string, string> = {
    'expo-update-id': u.updateId,
    'expo-is-embedded-update': String(u.isEmbeddedLaunch),
  };
  if (u.channel) tags['expo-channel'] = u.channel;
  if (u.runtimeVersion) tags['expo-runtime-version'] = u.runtimeVersion;
  return tags;
}

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
  Sentry.setTags(updateTags(Updates));
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
