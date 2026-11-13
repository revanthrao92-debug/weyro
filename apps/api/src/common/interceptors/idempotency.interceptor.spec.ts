import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { Prisma } from '@prisma/client';

function context(path: string, method: string, body: any, userId?: string) {
  const request: any = {
    method,
    path,
    route: { path },
    body,
    headers: { 'idempotency-key': 'same-key' },
    user: userId ? { sub: userId } : undefined,
  };
  const response: any = { statusCode: 201, status: jest.fn() };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as any;
}

describe('IdempotencyInterceptor', () => {
  let prisma: any;
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    prisma = {
      idempotencyKey: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    interceptor = new IdempotencyInterceptor(prisma);
  });

  it('scopes a key to principal, method and endpoint', async () => {
    prisma.idempotencyKey.create.mockResolvedValue({ id: 'idem-1' });
    await lastValueFrom(
      interceptor.intercept(context('/spare-parts', 'POST', { name: 'x' }, 'user-a'), {
        handle: () => of({ ok: true }),
      } as any),
    );

    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'same-key',
          userId: 'user-a',
          scope: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it('rejects a reused key with a different body', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'idem-1',
      status: 'PROCESSED',
      requestHash: 'different-hash',
      responseStatus: 201,
      responseBody: { leaked: true },
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.idempotencyKey.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      lastValueFrom(
        interceptor.intercept(context('/orders', 'POST', { x: 1 }, 'user-a'), {
          handle: () => of({ ok: true }),
        } as any),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replays the cached response for the same scoped request', async () => {
    prisma.idempotencyKey.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'idem-1',
      status: 'PROCESSED',
      requestHash: require('crypto')
        .createHash('sha256')
        .update(JSON.stringify({ x: 1 }))
        .digest('hex'),
      responseStatus: 200,
      responseBody: { cached: true },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await lastValueFrom(
      interceptor.intercept(context('/orders', 'POST', { x: 1 }, 'user-a'), {
        handle: () => of({ fresh: true }),
      } as any),
    );
    expect(result).toEqual({ cached: true });
  });

  it('never caches auth responses', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        context('/api/v1/auth/login', 'POST', { email: 'a' }),
        { handle: () => of({ accessToken: 'secret' }) } as any,
      ),
    );
    expect(result).toEqual({ accessToken: 'secret' });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('rejects an expired key instead of replaying', async () => {
    prisma.idempotencyKey.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'idem-1',
      status: 'PROCESSED',
      requestHash: 'x',
      responseStatus: 200,
      responseBody: { cached: true },
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(context('/orders', 'POST', {}, 'user-a'), {
          handle: () => of({}),
        } as any),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({
      where: { id: 'idem-1' },
    });
  });
});
