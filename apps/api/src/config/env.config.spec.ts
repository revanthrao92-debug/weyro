import { envSchema } from './env.config';

/** A complete, valid production environment; each test removes/changes one key. */
const productionEnv = (): Record<string, string> => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db.example.com:5432/weyro',
  DIRECT_URL: 'postgresql://u:p@db.example.com:5432/weyro',
  JWT_ACCESS_SECRET: 'prod_access_secret_that_is_long_and_random_0123456789',
  JWT_REFRESH_SECRET: 'prod_refresh_secret_that_is_long_and_random_9876543210',
  CORS_ORIGINS: 'https://app.weyro.in',
  STORAGE_DRIVER: 's3',
  STORAGE_BUCKET: 'weyro-prod',
  STORAGE_ACCESS_KEY: 'AKIAPRODKEY',
  STORAGE_SECRET_KEY: 'prod-storage-secret',
  RAZORPAY_KEY_ID: 'rzp_live_abc123',
  RAZORPAY_KEY_SECRET: 'live_key_secret_value_abc',
  RAZORPAY_WEBHOOK_SECRET: 'live_webhook_secret_value_xyz',
  OTP_HASH_SECRET: 'prod_otp_hash_secret_that_is_long_and_random_01',
  SMS_PROVIDER: 'msg91',
  MSG91_AUTH_KEY: 'msg91-key',
  MSG91_OTP_TEMPLATE_ID: 'tmpl-1',
  MSG91_SENDER_ID: 'WEYRO',
  TRUST_PROXY: '1',
});

const issuesFor = (input: Record<string, string>) => {
  const result = envSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('production env validation', () => {
  it('accepts a complete production environment', () => {
    expect(issuesFor(productionEnv())).toEqual([]);
  });

  describe('storage credentials', () => {
    it('AWS S3 needs no keys: the server uses its ECS task role', () => {
      const aws = productionEnv();
      delete aws.STORAGE_ACCESS_KEY;
      delete aws.STORAGE_SECRET_KEY;
      delete aws.STORAGE_ENDPOINT;
      expect(issuesFor(aws)).toEqual([]);
    });

    it('S3-compatible stores (R2, MinIO) still need both keys', () => {
      const r2 = { ...productionEnv(), STORAGE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com' };
      delete r2.STORAGE_ACCESS_KEY;
      delete r2.STORAGE_SECRET_KEY;
      expect(issuesFor(r2)).toEqual([
        'STORAGE_ACCESS_KEY: STORAGE_ACCESS_KEY is required in production when STORAGE_ENDPOINT is set',
        'STORAGE_SECRET_KEY: STORAGE_SECRET_KEY is required in production when STORAGE_ENDPOINT is set',
      ]);
    });
  });

  describe('H7 – TRUST_PROXY', () => {
    it('is required in production (missing or empty fails boot)', () => {
      const missing = productionEnv();
      delete missing.TRUST_PROXY;
      expect(issuesFor(missing)).toEqual(['TRUST_PROXY: TRUST_PROXY is required in production']);
      expect(issuesFor({ ...productionEnv(), TRUST_PROXY: '' })).toEqual([
        'TRUST_PROXY: TRUST_PROXY is required in production',
      ]);
    });

    it('rejects the blanket "true" in production', () => {
      expect(issuesFor({ ...productionEnv(), TRUST_PROXY: 'true' }).join('\n')).toMatch(/trusts every hop/);
    });

    it('accepts a hop count', () => {
      expect(issuesFor({ ...productionEnv(), TRUST_PROXY: '1' })).toEqual([]);
    });

    it('stays optional outside production', () => {
      const dev = { ...productionEnv(), NODE_ENV: 'development' };
      delete (dev as Record<string, string | undefined>).TRUST_PROXY;
      expect(issuesFor(dev)).toEqual([]);
    });
  });

  describe('C1 – MSG91 credentials', () => {
    it.each(['MSG91_AUTH_KEY', 'MSG91_OTP_TEMPLATE_ID', 'MSG91_SENDER_ID'])(
      'requires %s when SMS_PROVIDER=msg91',
      (key) => {
        const input = productionEnv();
        delete input[key];
        expect(issuesFor(input)).toEqual([`${key}: ${key} is required in production when SMS_PROVIDER=msg91`]);
      },
    );
  });

  it('H5 – OTP_GLOBAL_HOURLY_CAP defaults to 500 and is configurable', () => {
    const parsed = envSchema.parse(productionEnv());
    expect(parsed.OTP_GLOBAL_HOURLY_CAP).toBe(500);
    expect(envSchema.parse({ ...productionEnv(), OTP_GLOBAL_HOURLY_CAP: '50' }).OTP_GLOBAL_HOURLY_CAP).toBe(50);
  });
});
