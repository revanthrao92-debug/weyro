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
  useFactory: (): Redis | null => {
    if (!env.REDIS_URL) {
      return null; // Redis optional — dev/test without Redis works fine
    }
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      retryStrategy(times: number) {
        return Math.min(times * 200, 5000);
      },
      lazyConnect: false,
      enableOfflineQueue: false, // fail fast when Redis is down
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
