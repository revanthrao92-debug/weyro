import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

/**
 * CacheService — typed Redis cache with JSON serialisation + TTL.
 * Every operation catches Redis errors and falls back to the default
 * (Postgres remains the source of truth — Redis outage never blocks the API).
 */

export const CACHE_PREFIX = 'weyro:cache:';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  /** GET a cached value (parsed). Returns null on miss / Redis down. */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(CACHE_PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      this.logger.warn(`Cache GET failed for "${key}": ${err?.message}`);
      return null;
    }
  }

  /** SET a value with TTL seconds. Swallows errors (best-effort). */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(CACHE_PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`Cache SET failed for "${key}": ${err?.message}`);
    }
  }

  /** DELETE one or more keys (cache invalidation after mutations). */
  async del(...keys: string[]): Promise<void> {
    if (!this.redis || keys.length === 0) return;
    try {
      await this.redis.del(...keys.map((k) => CACHE_PREFIX + k));
    } catch (err: any) {
      this.logger.warn(`Cache DEL failed: ${err?.message}`);
    }
  }

  /** Invalidate all keys matching a pattern (e.g. "providers:*"). */
  async delPattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(CACHE_PREFIX + pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err: any) {
      this.logger.warn(`Cache DEL_PATTERN failed for "${pattern}": ${err?.message}`);
    }
  }

  /**
   * Get-or-set pattern: checks the cache first, falls back to the
   * loader (DB query), stores the result with TTL.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await loader();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /** Health probe. */
  async ping(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const res = await this.redis.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }
}
