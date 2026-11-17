import { Logger } from '@nestjs/common';
import { env } from '../../config/env.config';

/**
 * SMS gateway abstraction for the auth module (OTP delivery).
 *
 * Drivers:
 *  - `console`  : development/testing only. May log the code so developers can
 *                 sign in without an SMS provider. Refuses to run in production.
 *  - `msg91`    : MSG91 OTP API with a DLT-registered template. The code is
 *                 passed as the template variable (needs MSG91_* env vars).
 *  - `twilio`   : Twilio Messaging API with a body that includes the code
 *                 (needs SMS_TWILIO_* env vars).
 *
 * The code is NEVER logged by the real providers. Startup contract: in
 * production the module must be configured with a real provider and its
 * credentials; the service fails fast otherwise.
 */
export interface SmsGateway {
  /** Deliver an OTP code to a phone number (E.164). Throws on failure. */
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Minutes an OTP stays valid — shown in the SMS body and sent to MSG91. */
export const OTP_VALIDITY_MINUTES = 10;

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return `${'X'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

/** Dev driver: nothing is sent; the code is logged for local sign-in. */
export class ConsoleSmsGateway implements SmsGateway {
  private readonly logger = new Logger('SmsGateway');

  async sendOtp(phone: string, code: string): Promise<void> {
    if (env.NODE_ENV === 'production') {
      // Safety net — should never be selected in production (fail-fast in AuthModule).
      throw new Error(
        'ConsoleSmsGateway must never run in production. Configure SMS_PROVIDER.',
      );
    }
    this.logger.log(
      `[DEV ONLY] OTP for ${maskPhone(phone)} is ${code} (not actually sent)`,
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

  async sendOtp(phone: string, code: string): Promise<void> {
    this.assertConfigured();
    try {
      if (this.provider === 'msg91') {
        await this.sendMsg91(phone, code);
      } else {
        await this.sendTwilio(phone, code);
      }
      this.logger.log(`OTP SMS delivered to ${maskPhone(phone)} via ${this.provider}`);
    } catch (error) {
      this.logger.error(
        `OTP SMS delivery to ${maskPhone(phone)} failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * MSG91 OTP API (v5). Uses the DLT-registered template; MSG91 substitutes
   * `otp` into the template's variable. Mobile is country-code prefixed
   * without a leading "+".
   */
  private async sendMsg91(phone: string, code: string): Promise<void> {
    const authKey = this.credentials.MSG91_AUTH_KEY as string;
    const templateId = this.credentials.MSG91_OTP_TEMPLATE_ID as string;
    const senderId = this.credentials.MSG91_SENDER_ID as string;

    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', templateId);
    url.searchParams.set('mobile', phone.replace(/^\+/, ''));
    url.searchParams.set('otp', code);
    url.searchParams.set('otp_expiry', String(OTP_VALIDITY_MINUTES));

    const response = await fetch(url, {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: senderId, OTP: code }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`MSG91 returned HTTP ${response.status}`);
    }
    // MSG91 answers HTTP 200 with { type: 'error' } for rejected requests.
    const result = (await response.json().catch(() => null)) as {
      type?: string;
      message?: string;
    } | null;
    if (result?.type === 'error') {
      throw new Error(`MSG91 rejected the request: ${result.message ?? 'unknown error'}`);
    }
  }

  private async sendTwilio(phone: string, code: string): Promise<void> {
    const sid = this.credentials.SMS_TWILIO_ACCOUNT_SID as string;
    const token = this.credentials.SMS_TWILIO_AUTH_TOKEN as string;
    const from = this.credentials.SMS_TWILIO_FROM as string;
    const body = new URLSearchParams({
      To: phone,
      From: from,
      Body: `Your Weyro verification code is ${code}. It expires in ${OTP_VALIDITY_MINUTES} minutes. Do not share it with anyone.`,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
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
        MSG91_AUTH_KEY: env.MSG91_AUTH_KEY,
        MSG91_OTP_TEMPLATE_ID: env.MSG91_OTP_TEMPLATE_ID,
        MSG91_SENDER_ID: env.MSG91_SENDER_ID,
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
