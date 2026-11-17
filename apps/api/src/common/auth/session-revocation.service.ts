import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { env } from '../../config/env.config';

/** How long the no-Redis fallback trusts a user's `isActive` before re-reading it. */
export const ACTIVE_CACHE_TTL_MS = 60_000;

const REVOKED_PREFIX = 'user:revoked:';

function durationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 15 * 60;
  const unit: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * unit[match[2]];
}

/**
 * M10: access tokens are stateless JWTs, so suspending a user would otherwise
 * leave their token working until it expires. This service lets us cut it off:
 *
 *  - revokeUser() writes `user:revoked:<userId>` (value = revocation time, TTL =
 *    the access-token lifetime, after which every older token is dead anyway)
 *    and revokes all refresh tokens.
 *  - isRevoked() is what JwtAuthGuard asks. A token is refused when it was
 *    issued at or before the revocation time, so a fresh login afterwards works.
 *  - Without Redis, the guard falls back to the user's `isActive` flag, cached
 *    in memory for 60 seconds per instance.
 */
@Injectable()
export class SessionRevocationService {
  private readonly logger = new Logger(SessionRevocationService.name);
  private readonly accessTtlSeconds = durationSeconds(env.JWT_ACCESS_EXPIRES_IN);
  /** Revocations made by THIS process: immediate, and the only source if Redis is down. */
  private readonly localRevokedAt = new Map<string, { at: number; expires: number }>();
  private readonly activeCache = new Map<string, { active: boolean; fetchedAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  private redisReady(): boolean {
    return Boolean(this.redis && this.redis.status === 'ready');
  }

  /** Cut off every live session of a user (suspension / deactivation). */
  async revokeUser(userId: string): Promise<void> {
    const nowSeconds = Math.floor(Date.now() / 1000);

    this.localRevokedAt.set(userId, {
      at: nowSeconds,
      expires: Date.now() + this.accessTtlSeconds * 1000,
    });
    this.activeCache.delete(userId);

    if (this.redisReady()) {
      try {
        await this.redis!.set(
          `${REVOKED_PREFIX}${userId}`,
          String(nowSeconds),
          'EX',
          this.accessTtlSeconds,
        );
      } catch (error) {
        this.logger.error(
          `Could not write revocation marker for user ${userId} to Redis: ${(error as Error).message}`,
        );
      }
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.warn(`Revoked all sessions for user ${userId}`);
  }

  /**
   * Should a token issued at `issuedAt` (JWT `iat`, seconds) for `userId` be
   * refused right now?
   */
  async isRevoked(userId: string, issuedAt?: number): Promise<boolean> {
    const local = this.localRevokedAt.get(userId);
    if (local) {
      if (local.expires < Date.now()) {
        this.localRevokedAt.delete(userId);
      } else if (issuedAt === undefined || issuedAt <= local.at) {
        return true;
      }
    }

    if (this.redisReady()) {
      try {
        const value = await this.redis!.get(`${REVOKED_PREFIX}${userId}`);
        if (value === null) return false;
        const revokedAt = Number(value);
        return issuedAt === undefined || !Number.isFinite(revokedAt) || issuedAt <= revokedAt;
      } catch (error) {
        this.logger.warn(
          `Redis revocation lookup failed, falling back to isActive cache: ${(error as Error).message}`,
        );
      }
    }

    return !(await this.isActive(userId));
  }

  /** Cached (60s) read of `isActive && not deleted` for the no-Redis fallback. */
  private async isActive(userId: string): Promise<boolean> {
    const cached = this.activeCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < ACTIVE_CACHE_TTL_MS) {
      return cached.active;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, deletedAt: true },
    });
    // An unknown user id is not "revoked" here — authorization elsewhere handles it.
    const active = user ? user.isActive && !user.deletedAt : true;
    this.activeCache.set(userId, { active, fetchedAt: Date.now() });

    if (this.activeCache.size > 10_000) {
      const cutoff = Date.now() - ACTIVE_CACHE_TTL_MS;
      for (const [id, entry] of this.activeCache) {
        if (entry.fetchedAt < cutoff) this.activeCache.delete(id);
      }
    }
    return active;
  }
}
