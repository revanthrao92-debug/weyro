import { describe, it, expect, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

function build(redis?: unknown) {
  return new AuthService({} as never, {} as never, redis as never);
}

describe('AuthService OTP verify throttle', () => {
  it('enforces one shared Redis window across replicas', async () => {
    const redis = {
      status: 'ready',
      eval: jest.fn().mockResolvedValue(0),
    };
    const service = build(redis);

    await expect(
      (service as any).assertPhoneVerifyAllowance('+919876543210'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(redis.eval).toHaveBeenCalled();
  });

  it('allows a request inside the Redis window', async () => {
    const redis = {
      status: 'ready',
      eval: jest.fn().mockResolvedValue(1),
    };
    const service = build(redis);

    await expect(
      (service as any).assertPhoneVerifyAllowance('+919876543210'),
    ).resolves.toBeUndefined();
  });

  it('falls back to the local window when Redis fails', async () => {
    const redis = {
      status: 'ready',
      eval: jest.fn().mockRejectedValue(new Error('redis down')),
    };
    const service = build(redis);

    await expect(
      (service as any).assertPhoneVerifyAllowance('+919876543211'),
    ).resolves.toBeUndefined();
  });
});
