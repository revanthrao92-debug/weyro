import * as bcrypt from 'bcrypt';
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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((arg) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma),
      ),
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

  describe('account state gate', () => {
    it('refuses to mint tokens for an inactive user', async () => {
      const phone = '+919000000009';
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u9',
        role: 'CUSTOMER',
        phone,
        email: 'u9@example.com',
        isActive: false,
        deletedAt: null,
        customerProfile: { id: 'c9' },
        providerProfile: null,
      });

      await expect(
        service.verifyOtp({ phone, code: '123456' } as never),
      ).rejects.toThrow('This account is disabled');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockJwt.signAsync).not.toHaveBeenCalled();
    });

    it('binds an OTP to its issued purpose when both are supplied', async () => {
      const phone = '+919000000010';
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        purpose: 'reset_password',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });

      await expect(
        service.verifyOtp({ phone, code: '123456', purpose: 'login' } as never),
      ).rejects.toThrow('OTP is not valid for this action');
      expect(mockPrisma.oTP.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('password reset OTP verification', () => {
    it('accepts a correctly hashed reset code and updates the password', async () => {
      const phone = '+919000000011';
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        purpose: 'reset_password',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u11',
        role: 'CUSTOMER',
        phone,
        isActive: true,
      });
      mockPrisma.$transaction.mockImplementation((arg: any) =>
        Promise.resolve(Array.isArray(arg) ? arg : arg(mockPrisma)),
      );

      const result = await service.resetPassword({
        phone,
        code: '123456',
        newPassword: 'NewPass123!',
      } as never);

      expect(result.status).toBe('reset');
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.oTP.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { verifiedAt: expect.any(Date) } }),
      );
    });

    it('rejects a plaintext code that does not match the stored hash', async () => {
      const phone = '+919000000012';
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        purpose: 'reset_password',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });

      await expect(
        service.resetPassword({
          phone,
          code: '000000',
          newPassword: 'NewPass123!',
        } as never),
      ).rejects.toThrow('Invalid OTP code');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
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

    it('the gateway receives the exact code that is hashed and stored', async () => {
      const sendSpy = jest.spyOn(
        (service as unknown as { smsGateway: { sendOtp: unknown } }).smsGateway,
        'sendOtp',
      );
      const phone = '+919000000005';
      await service.sendOtp({ phone, purpose: 'login' } as never);

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [to, code] = sendSpy.mock.calls[0] as [string, string];
      expect(to).toBe(phone);
      // 6 digits, and it is the very code whose HMAC was persisted.
      expect(code).toMatch(/^[0-9]{6}$/);
      const stored = (mockPrisma.oTP.upsert as jest.Mock).mock.calls[0][0].create.code;
      expect(stored).toBe(validHash(phone, code));
    });

    it('H2 – codes come from a CSPRNG (never Math.random) and stay in 100000–999999', async () => {
      const randomSpy = jest.spyOn(Math, 'random');
      const sendSpy = jest.spyOn(
        (service as unknown as { smsGateway: { sendOtp: unknown } }).smsGateway,
        'sendOtp',
      );
      for (let i = 0; i < 25; i++) {
        mockPrisma.oTP.findUnique.mockResolvedValue(null);
        await service.sendOtp({ phone: `+9190000001${String(i).padStart(2, '0')}`, purpose: 'login' } as never);
      }
      expect(randomSpy).not.toHaveBeenCalled();
      for (const [, code] of sendSpy.mock.calls as [string, string][]) {
        expect(Number(code)).toBeGreaterThanOrEqual(100000);
        expect(Number(code)).toBeLessThanOrEqual(999999);
      }
      randomSpy.mockRestore();
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

  describe('H1 – account pre-takeover via unverified phone', () => {
    const phone = '+919876543210';

    const attackerRow = {
      id: 'attacker-claimed',
      email: 'attacker@example.com',
      phone,
      passwordHash: '$2b$12$attackerhash',
      role: 'CUSTOMER',
      isActive: true,
      deletedAt: null,
      phoneVerified: false,
      customerProfile: { id: 'cp1' },
      providerProfile: null,
    };

    it("victim's OTP login clears the attacker's password and revokes their refresh tokens", async () => {
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        purpose: 'login',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue(attackerRow);

      const result = await service.verifyOtp({ phone, code: '123456', purpose: 'login' } as never);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: attackerRow.id },
        data: { phoneVerified: true, passwordHash: '' },
      });
      // Revocation happens before the victim's new token pair is minted.
      const revoke = (mockPrisma.refreshToken.updateMany as jest.Mock).mock.calls[0][0];
      expect(revoke.where).toEqual({ userId: attackerRow.id, revokedAt: null });
      expect(revoke.data.revokedAt).toBeInstanceOf(Date);
      expect(
        (mockPrisma.refreshToken.updateMany as jest.Mock).mock.invocationCallOrder[0],
      ).toBeLessThan((mockPrisma.refreshToken.create as jest.Mock).mock.invocationCallOrder[0]);
      expect(result.accessToken).toBeDefined();
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('does not touch the password or sessions of an already verified user', async () => {
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        purpose: 'login',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ ...attackerRow, phoneVerified: true });

      await service.verifyOtp({ phone, code: '123456', purpose: 'login' } as never);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('password login is rejected for a user whose phone is not verified', async () => {
      const passwordHash = await bcrypt.hash('Passw0rd!', 4);
      mockPrisma.user.findFirst = jest
        .fn()
        .mockResolvedValue({ ...attackerRow, passwordHash });

      await expect(
        service.login({ emailOrPhone: phone, password: 'Passw0rd!' } as never),
      ).rejects.toThrow('Invalid email/phone or password');
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('password login works once the phone is verified', async () => {
      const passwordHash = await bcrypt.hash('Passw0rd!', 4);
      mockPrisma.user.findFirst = jest
        .fn()
        .mockResolvedValue({ ...attackerRow, passwordHash, phoneVerified: true });

      const result = await service.login({
        emailOrPhone: phone,
        password: 'Passw0rd!',
      } as never);
      expect(result.accessToken).toBeDefined();
    });

    it('register without a valid OTP never creates a user', async () => {
      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.oTP.findUnique.mockResolvedValue(null);

      await expect(
        service.register({
          email: 'a@example.com',
          phone,
          otpCode: '123456',
          password: 'Passw0rd!',
          role: 'CUSTOMER',
        } as never),
      ).rejects.toThrow(/Verify your phone number/);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('register with a wrong OTP is rejected and the account is not created', async () => {
      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        purpose: 'register',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });

      await expect(
        service.register({
          email: 'a@example.com',
          phone,
          otpCode: '000000',
          password: 'Passw0rd!',
          role: 'CUSTOMER',
        } as never),
      ).rejects.toThrow('Invalid OTP code');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("register is refused when the OTP was issued for a different purpose (e.g. login)", async () => {
      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        purpose: 'login',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });

      await expect(
        service.register({
          email: 'a@example.com',
          phone,
          otpCode: '123456',
          password: 'Passw0rd!',
          role: 'CUSTOMER',
        } as never),
      ).rejects.toThrow(/Verify your phone number/);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('register with the correct OTP creates a phone-verified user', async () => {
      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.oTP.findUnique.mockResolvedValue({
        phone,
        code: validHash(phone, '123456'),
        purpose: 'register',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
      });
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'a@example.com',
        phone,
        role: 'CUSTOMER',
        phoneVerified: true,
        customerProfile: { id: 'cp-new' },
        providerProfile: null,
      });

      await service.register({
        email: 'a@example.com',
        phone,
        otpCode: '123456',
        password: 'Passw0rd!',
        role: 'CUSTOMER',
      } as never);

      expect(mockPrisma.user.create.mock.calls[0][0].data).toMatchObject({
        phone,
        phoneVerified: true,
      });
      // The OTP is single-use: it is claimed as verified.
      expect(mockPrisma.oTP.updateMany).toHaveBeenCalledWith({
        where: { phone, verifiedAt: null },
        data: { verifiedAt: expect.any(Date) },
      });
    });
  });
});
