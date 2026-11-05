import { Logger } from '@nestjs/common';
import { env } from '../../config/env.config';

/**
 * SMS gateway abstraction for the auth module (OTP delivery).
 *
 * Drivers:
 *  - `console`  : development/testing only. NEVER logs the OTP code itself —
 *                 it logs a masked phone number only. The raw code can only be
 *                 obtained through the dev-only response field, which the
 *                 service strips in production.
 *  - `msg91`    : stub for the MSG91 HTTP API (needs SMS_MSG91_* env vars).
 *  - `twilio`   : stub for Twilio Messaging (needs SMS_TWILIO_* env vars).
 *
 * Startup contract: in production the module must be configured with a real
 * provider and its credentials; the service fails fast otherwise.
 */
export interface SmsGateway {
  /** Deliver a message to a phone number. Throws on failure. */
  send(to: string, text: string): Promise<void>;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return `${'X'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

/** Dev driver: announces delivery WITHOUT the code. */
export class ConsoleSmsGateway implements SmsGateway {
  private readonly logger = new Logger('SmsGateway');

  /** Dev driver: announces delivery WITHOUT the code. */
  async send(to: string, text: string): Promise<void> {
    if (env.NODE_ENV === 'production') {
      // Safety net — should never be selected in production (fail-fast in AuthModule).
      throw new Error(
        'ConsoleSmsGateway must never run in production. Configure SMS_PROVIDER.',
      );
    }
    this.logger.log(
      `[DEV ONLY] SMS to ${maskPhone(to)} (not actually sent). Message present: ${text.length > 0}`,
    );
  }
}

export class StubSmsGateway implements SmsGateway {
  private readonly requiredVars: string[];

  constructor(
    private readonly provider: 'msg91' | 'twilio',
    private readonly credentials: Record<string, string | undefined>,
  ) {
    this.requiredVars = Object.keys(credentials);
  }

  assertConfigured(): void {
    const missing = this.requiredVars.filter((k) => !this.credentials[k]);
    if (missing.length > 0) {
      throw new Error(
        `SMS_PROVIDER=${this.provider} selected but missing env vars: ${missing.join(', ')}. ` +
          'Set them or switch SMS_PROVIDER to console (dev only).',
      );
    }
  }

  async send(_to: string, _text: string): Promise<void> {
    // Real HTTP integration intentionally left to the provider-specific
    // implementation; this stub exists so the selection/config plumbing,
    // fail-fast checks and tests can be built before signing up for SMS.
    throw new Error(
      `SMS provider "${this.provider}" is not wired to a real HTTP client yet. Configure credentials and implement delivery.`,
    );
  }
}

/** Build the gateway selected by SMS_PROVIDER. */
export function buildSmsGateway(): SmsGateway {
  switch (env.SMS_PROVIDER) {
    case 'msg91':
      return new StubSmsGateway('msg91', {
        SMS_MSG91_AUTH_KEY: env.SMS_MSG91_AUTH_KEY,
        SMS_MSG91_SENDER_ID: env.SMS_MSG91_SENDER_ID,
      });
    case 'twilio':
      return new StubSmsGateway('twilio', {
        SMS_TWILIO_ACCOUNT_SID: env.SMS_TWILIO_ACCOUNT_SID,
        SMS_TWILIO_AUTH_TOKEN: env.SMS_TWILIO_AUTH_TOKEN,
        SMS_TWILIO_FROM: env.SMS_TWILIO_FROM,
      });
    default:
      return new ConsoleSmsGateway();
  }
}
