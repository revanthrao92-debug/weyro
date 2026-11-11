import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env.config';

const secret = env.OTP_HASH_SECRET || 'dev-driver-start-otp-secret';

/** HMAC the 4-digit start code; the plaintext code is never stored. */
export function hashDriverStartOtp(code: string): string {
  return createHmac('sha256', secret)
    .update(`driver-start:${code}`)
    .digest('hex');
}

export function verifyDriverStartOtp(code: string, hash: string | null): boolean {
  if (!hash) return false;
  const expected = Buffer.from(hashDriverStartOtp(code), 'hex');
  const supplied = Buffer.from(hash, 'hex');
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
