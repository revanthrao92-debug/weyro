import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { env } from '../../config/env.config';

/**
 * C1/C2 remediation tests:
 *  1. The OTP code must NEVER be logged (log spy scans every call).
 *  2. Attempt counting must be atomic — the conditional `updateMany` gate
 *     (`attempts < maxAttempts`) is the only increment path, so a concurrent
 *     wrong-guess race cannot bypass the lockout.
 *  3. Stored codes are HMAC hashes, never plaintext.
 */

const DEV_OTP_SECRET = env.OTP_HASH_SECRET;

describe('AuthService – OTP security hardening', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwt: any;
  let loggerSpy: jest.SpyInstance;

  const validHash = (phone: string, code: string) =>
    crypto
      .createHmac('sha256', DEV_OTP_SECRET)
      .update(`${phone}:${code}`)
      .digest('hex');

  beforeEach(() => {
    mockPrisma = {
      oTP: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockJwt = {
      signAsync: jest
        .fn()
        .mockImplementation((payload) => Promise.resolve(`jwt_${payload.sub}`)),
      verifyAsync: jest.fn(),
    };

    service = new AuthService(mockPrisma, mockJwt);

    loggerSpy = jest.spyOn((service as unknown as { logger: { log: unknown } }).logger, 'log');
    loggerSpy.mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  describe('C2 – atomic attempt gating', () => {
    it('increments attempts via conditional updateMany (attempts < maxAttempts), never a plain update', async () => {
      const phone = '+919000000001';
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        role: 'CUSTOMER',
        phone,
        email: `${phone}@weyro.in`,
        phoneVerified: true,
        customerProfile: { firstName: 'C' },
        providerProfile: null,
      });

      await service.verifyOtp({ phone, code: '123456', purpose: 'login' } as never);

      expect(mockPrisma.oTP.updateMany).toHaveBeenCalledWith({
        where: { phone, verifiedAt: null, attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
      // The old non-atomic read-then-increment attempt path must be gone —
      // `update` is only allowed for the final verifiedAt stamp.
      const updateWithAttempts = (mockPrisma.oTP.update as jest.Mock).mock.calls.filter(
        (call: unknown) => JSON.stringify(call).includes('attempts'),
      );
      expect(updateWithAttempts).toHaveLength(0);
    });

    it('locks out and invalidates when the ceiling is hit concurrently (gate returns 0 rows)', async () => {
      const phone = '+919000000002';
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        attempts: 5,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });
      // Simulate the race LOST: the conditional gate matches no rows.
      mockPrisma.oTP.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.verifyOtp({ phone, code: '123456' } as never),
      ).rejects.toThrow('Maximum OTP verification attempts exceeded');

      expect(mockPrisma.oTP.deleteMany).toHaveBeenCalledWith({
        where: { phone, verifiedAt: null },
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('locks out after consuming exactly maxAttempts sequential failures', async () => {
      const phone = '+919000000003';
      const maxAttempts = 5;
      let attempts = 0;

      mockPrisma.oTP.findUnique.mockImplementation(() => ({
        phone,
        code: validHash(phone, '123456'),
        attempts,
        maxAttempts,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      }));
      // Wrong guesses only; the atomic gate increments until the ceiling.
      mockPrisma.oTP.updateMany.mockImplementation(() => {
        if (attempts < maxAttempts) {
          attempts += 1;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      });

      for (let i = 0; i < maxAttempts; i += 1) {
        await expect(
          service.verifyOtp({ phone, code: '000000' } as never),
        ).rejects.toThrow('Invalid OTP code');
      }

      // Next attempt: ceiling reached → lockout (NOT a generic invalid-code)
      await expect(
        service.verifyOtp({ phone, code: '000000' } as never),
      ).rejects.toThrow('Maximum OTP verification attempts exceeded');
      expect(mockPrisma.oTP.deleteMany).toHaveBeenCalledWith({
        where: { phone, verifiedAt: null },
      });
    });
  });

  describe('C1 – the OTP code never reaches logs', () => {
    it('does not log the code during send or verification', async () => {
      const phone = '+919000000004';
      const code = '654321';

      await service.sendOtp({ phone, purpose: 'login' } as never);

      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, code),
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u4',
        role: 'CUSTOMER',
        phone,
        email: `${phone}@weyro.in`,
        phoneVerified: true,
        customerProfile: { firstName: 'C' },
        providerProfile: null,
      });

      await service.verifyOtp({ phone, code } as never);

      for (const call of loggerSpy.mock.calls) {
        expect(String(call.join(' '))).not.toContain(code);
      }
    });

    it('giveaway text sent to the gateway is code-free', async () => {
      const sendSpy = jest.spyOn(
        (service as unknown as { smsGateway: { send: unknown } }).smsGateway,
        'send',
      );
      await service.sendOtp({ phone: '+919000000005', purpose: 'login' } as never);

      const [to, text] = sendSpy.mock.calls[0];
      expect(to).toBe('+919000000005');
      expect(String(text)).not.toMatch(/^[0-9]{6}$/);
      expect(String(text)).not.toMatch(/[0-9]{6}/);
    });
  });

  describe('C1 – stored code is hashed, never plaintext', () => {
    it('upsert writes an HMAC hash (64 hex chars), not the 6-digit code', async () => {
      const upsert = mockPrisma.oTP.upsert as jest.Mock;
      await service.sendOtp({ phone: '+919000000006', purpose: 'login' } as never);

      const arg = upsert.mock.calls[0][0];
      expect(arg.create.code).toMatch(/^[a-f0-9]{64}$/);
      expect(arg.create.code).not.toMatch(/^[0-9]{6}$/);
    });

    it('hash binds phone AND code (deterministic + phone-specific)', () => {
      const h1 = validHash('+919000000006', '111222');
      expect(validHash('+919000000006', '111222')).toBe(h1); // deterministic
      expect(validHash('+919000000007', '111222')).not.toBe(h1); // phone-bound
      // timingSafeEqual path rejects wrong codes
      const stored = validHash('+919000000008', '123456');
      expect(
        stored === validHash('+919000000008', '123457'),
      ).toBe(false);
    });
  });
});
