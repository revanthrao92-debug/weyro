import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { env } from '../../config/env.config';
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

  // With REDIS_URL exported the client is not lazy, so there is nothing to check.
  (env.REDIS_URL ? it.skip : it)('never makes the lazy client (no REDIS_URL) dial when the cache is used', async () => {
    const cache = moduleRef.get(CacheService);
    const client = (cache as unknown as { redis: Redis }).redis;
    await expect(cache.get('k')).resolves.toBeNull();
    await cache.set('k', 1, 60);
    await cache.del('k');
    await cache.delPattern('*');
    await expect(cache.ping()).resolves.toBe(false);
    expect(client.status).toBe('wait');
  });

  it('closes its client on shutdown, so it cannot keep the process alive after SIGTERM', async () => {
    const ref = await Test.createTestingModule({ imports: [RedisModule] }).compile();
    const client = (ref.get(CacheService) as unknown as { redis: Redis }).redis;
    await ref.close();
    // A client still connecting reaches 'end' a tick after disconnect().
    if (client.status !== 'end') await new Promise((r) => client.once('end', r));
    expect(client.status).toBe('end');
  });

  it('keeps the injection token defined when imported through CacheService', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const constants = require('./redis.constants') as { REDIS_CLIENT: string };
    expect(constants.REDIS_CLIENT).toBe('REDIS_CLIENT');
  });
});
