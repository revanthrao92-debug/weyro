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
 *  - `msg91`    : MSG91 v2 SMS API (needs SMS_MSG91_* env vars).
 *  - `twilio`   : Twilio Messaging API (needs SMS_TWILIO_* env vars).
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

export class HttpSmsGateway implements SmsGateway {
  private readonly logger = new Logger('SmsGateway');
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

  async send(to: string, text: string): Promise<void> {
    this.assertConfigured();
    try {
      if (this.provider === 'msg91') {
        await this.sendMsg91(to, text);
      } else {
        await this.sendTwilio(to, text);
      }
      this.logger.log(`SMS delivered to ${maskPhone(to)} via ${this.provider}`);
    } catch (error) {
      this.logger.error(
        `SMS delivery to ${maskPhone(to)} failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async sendMsg91(to: string, text: string): Promise<void> {
    const authKey = this.credentials.SMS_MSG91_AUTH_KEY as string;
    const sender = this.credentials.SMS_MSG91_SENDER_ID as string;
    const response = await fetch('https://api.msg91.com/api/v2/sendsms', {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        route: '4',
        country: '91',
        sms: [{ message: text, to: to.replace(/^\+?91/, '') }],
      }),
    });
    if (!response.ok) {
      throw new Error(`MSG91 returned HTTP ${response.status}`);
    }
  }

  private async sendTwilio(to: string, text: string): Promise<void> {
    const sid = this.credentials.SMS_TWILIO_ACCOUNT_SID as string;
    const token = this.credentials.SMS_TWILIO_AUTH_TOKEN as string;
    const from = this.credentials.SMS_TWILIO_FROM as string;
    const body = new URLSearchParams({ To: to, From: from, Body: text });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    if (!response.ok) {
      throw new Error(`Twilio returned HTTP ${response.status}`);
    }
  }
}

/** Build the gateway selected by SMS_PROVIDER. */
export function buildSmsGateway(): SmsGateway {
  switch (env.SMS_PROVIDER) {
    case 'msg91':
      return new HttpSmsGateway('msg91', {
        SMS_MSG91_AUTH_KEY: env.SMS_MSG91_AUTH_KEY,
        SMS_MSG91_SENDER_ID: env.SMS_MSG91_SENDER_ID,
      });
    case 'twilio':
      return new HttpSmsGateway('twilio', {
        SMS_TWILIO_ACCOUNT_SID: env.SMS_TWILIO_ACCOUNT_SID,
        SMS_TWILIO_AUTH_TOKEN: env.SMS_TWILIO_AUTH_TOKEN,
        SMS_TWILIO_FROM: env.SMS_TWILIO_FROM,
      });
    default:
      return new ConsoleSmsGateway();
  }
}
