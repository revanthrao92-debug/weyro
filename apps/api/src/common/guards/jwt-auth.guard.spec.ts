import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { env } from '../../config/env.config';

function context(authorization?: string) {
  const request: any = { headers: authorization ? { authorization } : {} };
  return {
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any,
  };
}

function guardFor(isPublic = false) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as any;
  return new JwtAuthGuard(new JwtService(), reflector);
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService();
  const payload = {
    sub: 'user-1',
    email: 'user@test.com',
    role: 'CUSTOMER' as const,
  };

  it('accepts a valid token and attaches the payload', async () => {
    const token = await jwt.signAsync(payload, { secret: env.JWT_ACCESS_SECRET });
    const { ctx, request } = context(`Bearer ${token}`);
    await expect(guardFor().canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: 'user-1', role: 'CUSTOMER' });
  });

  it('rejects a forged token signed with another secret', async () => {
    const token = await jwt.signAsync(payload, {
      secret: 'attacker-secret-that-is-long-enough-32chars',
    });
    const { ctx } = context(`Bearer ${token}`);
    await expect(guardFor().canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const token = await jwt.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: '-5s',
    });
    const { ctx } = context(`Bearer ${token}`);
    await expect(guardFor().canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a malformed token', async () => {
    const { ctx } = context('Bearer not-a-jwt');
    await expect(guardFor().canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token without a subject claim', async () => {
    const token = await jwt.signAsync(
      { email: 'x@test.com', role: 'CUSTOMER' },
      { secret: env.JWT_ACCESS_SECRET },
    );
    const { ctx } = context(`Bearer ${token}`);
    await expect(guardFor().canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token with an unknown role claim', async () => {
    const token = await jwt.signAsync(
      { ...payload, role: 'SUPERUSER' },
      { secret: env.JWT_ACCESS_SECRET },
    );
    const { ctx } = context(`Bearer ${token}`);
    await expect(guardFor().canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows @Public routes without a token', async () => {
    const { ctx } = context(undefined);
    await expect(guardFor(true).canActivate(ctx)).resolves.toBe(true);
  });
});
