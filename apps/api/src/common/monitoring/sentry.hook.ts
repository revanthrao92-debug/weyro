import { Logger, Injectable } from '@nestjs/common';
import { env } from '../../config/env.config';

/**
 * STEP 8 — Sentry-compatible error-reporting hook.
 * Activated only when `SENTRY_DSN` is set (and production or explicitly
 * enabled via `SENTRY_ENABLED=true`). wrapping `@sentry/node` behind a
 * no-op when not configured — zero cost in dev.
 */
const logger = new Logger('SentryHook');

export const SentryHook = (() => {
  let initialized = false;
  let captureException: ((err: unknown, ctx?: Record<string, unknown>) => void) | null = null;

  function init(): void {
    if (initialized) return;
    initialized = true;

    if (!env.SENTRY_DSN) {
      return;
    }

    try {
      // Static import is not possible because @sentry/node must not be a hard
      // dependency for dev/test; lazily loaded here when the DSN is set.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/node');
      Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
      captureException = (err, ctx) => Sentry.captureException(err, { extra: ctx });
    } catch (err: any) {
      logger.error(`Sentry init failed: ${err?.message}`);
    }
  }

  return {
    init,
    captureException(err: unknown, ctx?: Record<string, unknown>): void {
      init();
      try {
        captureException?.(err, ctx);
      } catch {
        /* never break the caller */
      }
    },
  };
})();
