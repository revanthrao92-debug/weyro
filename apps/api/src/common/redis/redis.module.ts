import { Global, Module, Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../../config/env.config';
import { CacheService } from './cache.service';

/**
 * RedisModule — centralised Redis infrastructure.
 *
 * Provides a SINGLE shared ioredis connection (avoids connection sprawl).
 * Exposes:
 *   - `REDIS_CLIENT` injection token (raw ioredis client)
 *   - `CacheService` (typed cache with JSON serialisation + TTL)
 *
 * Fallback: every CacheService method catches Redis errors and falls back
 * to the caller's default (Postgres remains the source of truth). The app
 * never crashes because Redis is down.
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => {
    // Always return a valid Redis instance so NestJS can resolve the token.
    // Without REDIS_URL: lazyConnect + no offline queue = the client never
    // dials, CacheService catches errors, and Postgres remains the fallback.
    const client = new Redis(env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 2,
      retryStrategy(times: number) {
        return Math.min(times * 200, 5000);
      },
      lazyConnect: !env.REDIS_URL, // don't dial when no URL configured
      enableOfflineQueue: false,
    });

    client.on('error', (err: Error) => {
      console.warn(`[Redis] connection error: ${err.message}`);
    });
    client.on('connect', () => {
      console.log('[Redis] connected');
    });
    client.on('close', () => {
      console.warn('[Redis] connection closed');
    });

    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider, CacheService],
  exports: [CacheService, redisProvider],
})
export class RedisModule {}
