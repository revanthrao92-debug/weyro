/**
 * Injection token for the shared ioredis client.
 *
 * This lives in its own module on purpose. `redis.module.ts` imports
 * `CacheService`, and `CacheService` needs this token. When the token was
 * declared in the module file, requiring `cache.service` from `redis.module`
 * evaluated the `@Inject(REDIS_CLIENT)` decorator while `REDIS_CLIENT` was
 * still `undefined` (the assignment sits after the import). Because the
 * dependency is `@Optional()`, Nest injected `undefined` instead of failing
 * at boot: the cache never reached Redis and `/health/redis` reported `down`
 * on a healthy instance.
 *
 * Keep this file free of imports so it can never participate in a cycle.
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';
