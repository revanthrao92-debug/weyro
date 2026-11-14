import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';

// Load .env files: current working dir, apps/api/.env, and root repo .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(4000),
  // Public base URL used by the local development storage driver.
  API_PUBLIC_URL: z.string().url().optional(),
  // Set to a hop count (e.g. "1") when the API sits behind a load balancer so
  // per-IP rate limiting sees client addresses instead of the proxy's.
  TRUST_PROXY: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  // Reserved for signed refresh tokens. Current refresh tokens are opaque
  // (40 random bytes) and stored only as SHA-256 hashes — stronger than a JWT.
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
  // Set true only for providers that require path-style S3 URLs (MinIO).
  STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
  // Private buckets serve uploads through short-lived presigned GETs.
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(604800),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Explicit gateway choice. Omitted = Razorpay when keys exist, mock only in
  // non-production. Production is rejected if mock is requested.
  PAYMENT_GATEWAY: z.enum(['razorpay', 'mock']).optional(),
  // OTP hashing secret (HMAC-SHA256). Dev default keeps tests simple;
  // production must supply a real random secret.
  OTP_HASH_SECRET: z.string().default('weyro_dev_otp_hash_secret_32_chars_x'),
  // Development-only OTP echo. Must be explicitly enabled and is rejected in
  // production. Never key this on NODE_ENV alone.
  OTP_DEBUG_ECHO: z.enum(['true', 'false']).default('false'),
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
  // STEP 7 — Redis (optional; in-memory throttler + no socket adapter when unset)
  REDIS_URL: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') {
    return;
  }

  const defaultCors =
    'http://localhost:3000,http://localhost:8081,http://localhost:19006,http://localhost:8082';
  if (value.CORS_ORIGINS === defaultCors) {
    ctx.addIssue({
      code: "custom",
      path: ['CORS_ORIGINS'],
      message: 'CORS_ORIGINS must be set explicitly in production',
    });
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

  if (value.STORAGE_PUBLIC_URL) {
    ctx.addIssue({
      code: "custom",
      path: ['STORAGE_PUBLIC_URL'],
      message:
        'STORAGE_PUBLIC_URL must be unset in production — uploads are served through short-lived signed URLs',
    });
  }

  if (value.PAYMENT_GATEWAY === 'mock') {
    ctx.addIssue({
      code: "custom",
      path: ['PAYMENT_GATEWAY'],
      message: 'PAYMENT_GATEWAY=mock is not allowed in production',
    });
  }

  const devSecrets = new Set([
    'weyro_dev_jwt_access_secret_super_key_32_chars',
    'weyro_dev_jwt_refresh_secret_super_key_32_chars',
    'dev_access_secret_key_change_me_32chars',
    'dev_refresh_secret_key_change_me_32chars',
  ]);
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (devSecrets.has(value[key])) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} must not use the published development value in production`,
      });
    }
  }
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ['JWT_REFRESH_SECRET'],
      message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
    });
  }

  if (value.OTP_DEBUG_ECHO === 'true') {
    ctx.addIssue({
      code: "custom",
      path: ['OTP_DEBUG_ECHO'],
      message: 'OTP_DEBUG_ECHO must not be enabled in production',
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
