import { ACTIVE_CACHE_TTL_MS, SessionRevocationService } from './session-revocation.service';
import { env } from '../../config/env.config';

/** M10: suspended users lose access immediately, with or without Redis. */
describe('SessionRevocationService', () => {
  let prisma: any;
  const NOW = new Date('2026-11-16T12:00:00Z');
  const nowSeconds = Math.floor(NOW.getTime() / 1000);

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(NOW);
    prisma = {
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, deletedAt: null }) },
    };
  });
  afterEach(() => jest.useRealTimers());

  const redisStub = (store: Record<string, string> = {}) => ({
    status: 'ready',
    set: jest.fn().mockImplementation(async (k: string, v: string) => {
      store[k] = v;
      return 'OK';
    }),
    get: jest.fn().mockImplementation(async (k: string) => store[k] ?? null),
  });

  describe('with Redis', () => {
    it('revokeUser writes user:revoked:<id> with the access-token lifetime as TTL and revokes refresh tokens', async () => {
      const redis = redisStub();
      const service = new SessionRevocationService(prisma, redis as never);

      await service.revokeUser('user-1');

      expect(redis.set).toHaveBeenCalledWith('user:revoked:user-1', String(nowSeconds), 'EX', 900);
      expect(env.JWT_ACCESS_EXPIRES_IN).toBe('15m'); // 900s
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('another instance sees the revocation through Redis, and only for tokens issued before it', async () => {
      const store: Record<string, string> = {};
      await new SessionRevocationService(prisma, redisStub(store) as never).revokeUser('user-1');

      const otherInstance = new SessionRevocationService(prisma, redisStub(store) as never);
      expect(await otherInstance.isRevoked('user-1', nowSeconds - 60)).toBe(true); // old token: refused
      expect(await otherInstance.isRevoked('user-1', nowSeconds)).toBe(true); // issued in the same second
      expect(await otherInstance.isRevoked('user-1', nowSeconds + 5)).toBe(false); // fresh login afterwards
      expect(await otherInstance.isRevoked('someone-else', nowSeconds - 60)).toBe(false);
      // With Redis healthy the database is not consulted per request.
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('a token with no iat is refused when the user is revoked', async () => {
      const store: Record<string, string> = {};
      await new SessionRevocationService(prisma, redisStub(store) as never).revokeUser('user-1');
      expect(await new SessionRevocationService(prisma, redisStub(store) as never).isRevoked('user-1')).toBe(true);
    });

    it('still revokes refresh tokens and this instance if Redis rejects the write', async () => {
      const redis = redisStub();
      redis.set.mockRejectedValue(new Error('READONLY'));
      const service = new SessionRevocationService(prisma, redis as never);
      jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

      await service.revokeUser('user-1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      redis.get.mockRejectedValue(new Error('down'));
      expect(await service.isRevoked('user-1', nowSeconds - 1)).toBe(true); // local memory
    });

    it('falls back to the isActive cache when a Redis read fails', async () => {
      const redis = redisStub();
      redis.get.mockRejectedValue(new Error('ECONNRESET'));
      const service = new SessionRevocationService(prisma, redis as never);
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      prisma.user.findUnique.mockResolvedValue({ isActive: false, deletedAt: null });

      expect(await service.isRevoked('user-1', nowSeconds)).toBe(true);
    });
  });

  describe('without Redis (60s in-memory isActive cache)', () => {
    it('refuses a deactivated user and lets an active one through', async () => {
      const service = new SessionRevocationService(prisma);
      prisma.user.findUnique.mockResolvedValueOnce({ isActive: false, deletedAt: null });
      expect(await service.isRevoked('gone', nowSeconds)).toBe(true);

      prisma.user.findUnique.mockResolvedValueOnce({ isActive: true, deletedAt: null });
      expect(await service.isRevoked('fine', nowSeconds)).toBe(false);

      prisma.user.findUnique.mockResolvedValueOnce({ isActive: true, deletedAt: new Date() });
      expect(await service.isRevoked('deleted', nowSeconds)).toBe(true);
    });

    it('caches isActive for 60 seconds, then re-reads it', async () => {
      const service = new SessionRevocationService(prisma);
      for (let i = 0; i < 5; i++) await service.isRevoked('user-1', nowSeconds);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      jest.setSystemTime(new Date(NOW.getTime() + ACTIVE_CACHE_TTL_MS - 1));
      await service.isRevoked('user-1', nowSeconds);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      jest.setSystemTime(new Date(NOW.getTime() + ACTIVE_CACHE_TTL_MS + 1));
      await service.isRevoked('user-1', nowSeconds);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('a revocation made on this instance bypasses the cache immediately', async () => {
      const service = new SessionRevocationService(prisma);
      expect(await service.isRevoked('user-1', nowSeconds)).toBe(false); // cached "active"

      await service.revokeUser('user-1');
      expect(await service.isRevoked('user-1', nowSeconds - 1)).toBe(true);
      expect(await service.isRevoked('user-1', nowSeconds + 10)).toBe(false); // fresh token after revocation
    });

    it('the local revocation expires with the access-token lifetime', async () => {
      const service = new SessionRevocationService(prisma);
      await service.revokeUser('user-1');
      jest.setSystemTime(new Date(NOW.getTime() + 901_000));
      expect(await service.isRevoked('user-1', nowSeconds - 1)).toBe(false);
    });

    it('an unknown user id is not treated as revoked', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      expect(await new SessionRevocationService(prisma).isRevoked('ghost', nowSeconds)).toBe(false);
    });
  });
});
