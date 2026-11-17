import * as Sentry from '@sentry/nestjs';

/**
 * Report a server-side failure (5xx / unhandled). A no-op when SENTRY_DSN is not
 * configured. The event is scrubbed by `beforeSend` (see instrument.ts).
 */
export function captureServerError(
  exception: unknown,
  context: { requestId?: string; method?: string; path?: string } = {},
): void {
  if (!Sentry.isInitialized()) return;
  Sentry.withScope((scope) => {
    if (context.requestId) scope.setTag('requestId', context.requestId);
    if (context.method) scope.setTag('http.method', context.method);
    // Route path only: never the query string, which can carry phone numbers or tokens.
    if (context.path) scope.setTag('http.path', context.path.split('?')[0]);
    Sentry.captureException(exception);
  });
}
