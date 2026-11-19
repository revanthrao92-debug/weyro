import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { RedisModule } from './redis.module';

/**
 * Regression guard for the require cycle that used to leave CacheService
 * without a client:
 *
 *   redis.module  ->  import CacheService
 *   cache.service ->  import REDIS_CLIENT from redis.module
 *
 * The token did not exist yet while cache.service was being decorated, so
 * `@Optional() @Inject(REDIS_CLIENT)` resolved to `undefined` and every cache
 * operation silently became a no-op (and `/health/redis` reported "down" on a
 * healthy instance). The token now lives in redis.constants.ts.
 *
 * This test asserts the wiring itself, not Redis connectivity, so it runs
 * without a server.
 */
describe('RedisModule wiring', () => {
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();
  });

  afterAll(async () => {
    const cache = moduleRef.get(CacheService);
    const client = (cache as unknown as { redis?: Redis }).redis;
    await client?.quit().catch(() => client?.disconnect());
    await moduleRef.close();
  });

  it('injects a real ioredis client into CacheService', () => {
    const cache = moduleRef.get(CacheService);
    const client = (cache as unknown as { redis?: Redis }).redis;

    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(Redis);
  });

  it('keeps the injection token defined when imported through CacheService', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const constants = require('./redis.constants') as { REDIS_CLIENT: string };
    expect(constants.REDIS_CLIENT).toBe('REDIS_CLIENT');
  });
});
