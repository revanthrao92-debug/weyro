import * as crypto from 'crypto';
import { env } from '../config/env.config';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * H1: password registration now requires a `register` OTP. E2E tests plant a
 * known OTP row directly (stored as the same HMAC the service uses) so they can
 * register users without an SMS provider. `phone` must already be E.164.
 */
export async function seedRegisterOtp(
  prisma: PrismaService,
  phone: string,
  code = '123456',
): Promise<string> {
  const hash = crypto
    .createHmac('sha256', env.OTP_HASH_SECRET)
    .update(`${phone}:${code}`)
    .digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.oTP.upsert({
    where: { phone },
    update: { code: hash, purpose: 'register', attempts: 0, expiresAt, verifiedAt: null },
    create: { phone, code: hash, purpose: 'register', expiresAt },
  });
  return code;
}
