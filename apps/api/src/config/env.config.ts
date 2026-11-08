import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';

// Load .env files: current working dir, apps/api/.env, and root repo .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(4000),
  // Set to a hop count (e.g. "1") when the API sits behind a load balancer so
  // per-IP rate limiting sees client addresses instead of the proxy's.
  TRUST_PROXY: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:8081,http://localhost:19006,http://localhost:8082'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().default('ap-south-1'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // OTP hashing secret (HMAC-SHA256). Dev default keeps tests simple;
  // production must supply a real random secret.
  OTP_HASH_SECRET: z.string().default('weyro_dev_otp_hash_secret_32_chars_x'),
  // SMS delivery driver for OTP: console (dev), msg91, twilio
  SMS_PROVIDER: z.enum(['console', 'msg91', 'twilio']).default('console'),
  SMS_MSG91_AUTH_KEY: z.string().optional(),
  SMS_MSG91_SENDER_ID: z.string().optional(),
  SMS_TWILIO_ACCOUNT_SID: z.string().optional(),
  SMS_TWILIO_AUTH_TOKEN: z.string().optional(),
  SMS_TWILIO_FROM: z.string().optional(),
  // STEP 2 — reconciliation knobs
  PAYMENT_RECONCILE_WINDOW_MINUTES: z.coerce.number().default(15),
  PAYMENT_RECONCILE_BATCH: z.coerce.number().default(25),
  // STEP 8 — Sentry (optional): only active when DSN set
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENABLED: z.string().optional(),
  // STEP 7 — Redis (optional; in-memory throttler + no socket adapter when unset)
  REDIS_URL: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') {
    return;
  }

  if (value.CORS_ORIGINS.split(',').map((o) => o.trim()).includes('*')) {
    ctx.addIssue({
      code: "custom",
      path: ['CORS_ORIGINS'],
      message: 'CORS_ORIGINS must not contain * in production',
    });
  }

  if (value.STORAGE_DRIVER !== 's3') {
    ctx.addIssue({
      code: "custom",
      path: ['STORAGE_DRIVER'],
      message: 'STORAGE_DRIVER must be s3 in production',
    });
  }

  for (const key of [
    'STORAGE_BUCKET',
    'STORAGE_ACCESS_KEY',
    'STORAGE_SECRET_KEY',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'OTP_HASH_SECRET',
    'SMS_PROVIDER',
  ] as const) {
    if (!value[key]) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} is required in production`,
      });
    }
  }

  // OTP hashing secret must be lifted off the dev default in production.
  if (value.OTP_HASH_SECRET === 'weyro_dev_otp_hash_secret_32_chars_x') {
    ctx.addIssue({
      code: "custom",
      path: ['OTP_HASH_SECRET'],
      message:
        'OTP_HASH_SECRET must be a strong random value in production (dev default is not allowed)',
    });
  }

  // A real SMS provider (with credentials) is mandatory in production.
  if (value.SMS_PROVIDER === 'console') {
    ctx.addIssue({
      code: "custom",
      path: ['SMS_PROVIDER'],
      message: 'SMS_PROVIDER must be a real provider (msg91|twilio) in production',
    });
  }

  // H1: the webhook signing secret must be independent of the API key secret
  // and must not be a placeholder value.
  if (
    value.RAZORPAY_WEBHOOK_SECRET &&
    (value.RAZORPAY_WEBHOOK_SECRET === value.RAZORPAY_KEY_SECRET ||
      value.RAZORPAY_WEBHOOK_SECRET === 'rzp_placeholder_webhook_secret')
  ) {
    ctx.addIssue({
      code: "custom",
      path: ['RAZORPAY_WEBHOOK_SECRET'],
      message:
        'RAZORPAY_WEBHOOK_SECRET must be independent of the API key secret (placeholder/dev values rejected)',
    });
  }
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ FATAL: Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  - [${issue.path.join('.')}]: ${issue.message}`);
    }
    throw new Error(
      `Invalid environment configuration: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export const env = getEnv();
