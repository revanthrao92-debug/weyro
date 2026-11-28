import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { normalizePhone } from '@weyro/validation';
import { env } from '../../config/env.config';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { buildSmsGateway, SmsGateway } from './sms.gateway';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';

// Pre-computed bcrypt hash for constant-time comparison when user does not exist
const DUMMY_HASH =
  '$2b$12$K8pYtLqZ1mK1qUuV5gD0e.2f7u0v2z9eY5l1s5h3m2w4v6k8q0z7a';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly smsGateway: SmsGateway;

  /** H5: OTP send limits. */
  private static readonly OTP_RESEND_COOLDOWN_SECONDS = 30;
  private static readonly OTP_MAX_SENDS_PER_DAY = 5;

  /** M2: per-phone verify throttle (in-memory sliding window, per instance). */
  private static readonly VERIFY_WINDOW_MS = 60_000;
  private static readonly VERIFY_MAX_PER_WINDOW = 10;
  private readonly verifyAttemptsByPhone = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis?: Redis,
  ) {
    this.smsGateway = buildSmsGateway();
    // Fail fast when a real provider is selected without its credentials.
    (
      this.smsGateway as SmsGateway & { assertConfigured?: () => void }
    ).assertConfigured?.();
  }

  /** HMAC-SHA256 hash of an OTP — codes are never stored or compared in plaintext. */
  private hashOtp(phone: string, code: string): string {
    return crypto
      .createHmac('sha256', env.OTP_HASH_SECRET)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  /** Constant-time comparison of the received code against the stored hash. */
  private otpMatches(phone: string, code: string, storedHash: string): boolean {
    const candidate = this.hashOtp(phone, code);
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(storedHash, 'utf8');
    if (a.length !== b.length) return false; // length mismatch → invalid
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * H1: consume a `register`-purpose OTP for password sign-up. Same guarantees
   * as verifyOtp: atomic attempt ceiling, constant-time hash compare, and the
   * code can be used exactly once.
   */
  private async consumeRegisterOtp(phone: string, code: string): Promise<void> {
    await this.assertPhoneVerifyAllowance(phone);

    const otp = await this.prisma.oTP.findUnique({ where: { phone } });
    if (
      !otp ||
      otp.verifiedAt ||
      otp.purpose !== 'register' ||
      otp.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Verify your phone number with a valid OTP before registering',
      );
    }

    const gate = await this.prisma.oTP.updateMany({
      where: { phone, verifiedAt: null, attempts: { lt: otp.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (gate.count === 0) {
      await this.prisma.oTP.deleteMany({ where: { phone, verifiedAt: null } });
      throw new BadRequestException('Maximum OTP verification attempts exceeded');
    }

    if (!this.otpMatches(phone, code, otp.code)) {
      throw new BadRequestException('Invalid OTP code');
    }

    const claimed = await this.prisma.oTP.updateMany({
      where: { phone, verifiedAt: null },
      data: { verifiedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('OTP has already been used');
    }
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    // dto.phone is already E.164 (shared phoneSchema).
    const phone = dto.phone.trim();

    if (
      (dto.role === 'PROVIDER' || dto.role === 'BOTH') &&
      (dto.latitude === undefined || dto.longitude === undefined)
    ) {
      throw new BadRequestException(
        'Provider registration requires latitude and longitude',
      );
    }

    // Check existing
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.email === email
          ? 'An account with this email already exists'
          : 'An account with this phone number already exists',
      );
    }

    // H1: the caller must prove they own this phone before an account (and a
    // password) can be bound to it — otherwise anyone could pre-register a
    // victim's number and keep a live password/session on it.
    await this.consumeRegisterOtp(phone, dto.otpCode);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        phoneVerified: true,
        role: dto.role,
        customerProfile:
          dto.role === 'CUSTOMER' || dto.role === 'BOTH'
            ? {
                create: {
                  firstName: dto.firstName || 'Customer',
                  lastName: dto.lastName || 'User',
                },
              }
            : undefined,
        providerProfile:
          dto.role === 'PROVIDER' || dto.role === 'BOTH'
            ? {
                create: {
                  businessName: dto.businessName as string, // required for providers by RegisterSchema
                  providerType: dto.providerType || 'MECHANIC',
                  description:
                    dto.description || 'Automotive service & parts specialist',
                  phone,
                  address: dto.address as string, // required for providers by RegisterSchema
                  latitude: dto.latitude as number,
                  longitude: dto.longitude as number,
                  verificationStatus: 'PENDING',
                  towingVehicleTypes: dto.towingVehicleTypes ?? [],
                  maxVehicleWeightKg: dto.maxVehicleWeightKg,
                  towingBaseFee: dto.towingBaseFee,
                  towingPerKmFee: dto.towingPerKmFee,
                },
              }
            : undefined,
      },
      include: {
        customerProfile: true,
        providerProfile: true,
      },
    });

    const tokens = await this.generateTokenPair(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const rawTerm = (dto.emailOrPhone || dto.email || '').trim();
    const term = rawTerm.toLowerCase();
    // H3: a phone identifier is normalized to E.164 so 9876543210,
    // 09876543210 and +91 98765 43210 all reach the same account.
    const phoneTerm = rawTerm.includes('@')
      ? rawTerm
      : (normalizePhone(rawTerm) ?? rawTerm);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: term }, { phone: phoneTerm }],
      },
      include: {
        customerProfile: true,
        providerProfile: true,
      },
    });

    // Constant-time check to prevent timing attacks
    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(dto.password, hashToCompare);

    // H1: a password can only authenticate an account whose phone was proven
    // via OTP. Legacy unverified rows must sign in with an OTP first.
    if (!user || !isPasswordValid || !user.isActive || !user.phoneVerified) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }

    const tokens = await this.generateTokenPair(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshToken(refreshTokenStr: string) {
    const tokenHash = this.hashToken(refreshTokenStr);

    // M3: look up the token row WITHOUT the revokedAt filter first so a
    // replay of an already-rotated token is distinguished from a fully
    // unknown token.
    const tokenRow = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });

    if (!tokenRow) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Reuse of an already-rotated token means either replay (benign) or a
    // stolen-token attack (malicious). In both cases the safest response is
    // to revoke every token in the rotation family and make the user log in
    // again.
    if (tokenRow.revokedAt) {
      const familyId = tokenRow.familyId ?? tokenRow.id;
      await this.prisma.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh token reuse detected (family=${tokenRow.familyId?.slice(0, 8) ?? 'n/a'}) — family revoked`,
      );
      throw new UnauthorizedException(
        'Refresh token reuse detected; all sessions for this login were revoked. Please sign in again.',
      );
    }

    if (tokenRow.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenRow.id },
      include: {
        user: {
          include: {
            customerProfile: true,
            providerProfile: true,
          },
        },
      },
    });

    if (!storedToken || !storedToken.user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate token atomically: revoke current and issue a new one in the
    // SAME rotation family.
    const newTokens = await this.prisma.$transaction(async (tx) => {
      // Atomic rotation: only the winner of a concurrent refresh may revoke
      // and replace this row. The loser must not mint a second live chain.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: storedToken.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new UnauthorizedException(
          'Refresh token was already rotated. Please sign in again.',
        );
      }

      return await this.generateTokenPair(storedToken.user, tx, storedToken.familyId);
    });

    return {
      user: this.sanitizeUser(storedToken.user),
      ...newTokens,
    };
  }

  async logout(userId: string, refreshTokenStr?: string, pushToken?: string) {
    if (pushToken) {
      await this.prisma.pushToken.deleteMany({
        where: { userId, token: pushToken },
      });
    }
    if (refreshTokenStr) {
      const tokenHash = this.hashToken(refreshTokenStr);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { success: true, message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customerProfile: true,
        providerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Send a 6-digit OTP to the user's phone through the configured SMS gateway.
   * Only the HMAC hash of the code is stored.
   */
  async sendOtp(dto: SendOtpDto) {
    const phone = dto.phone.trim();

    // H5: per-phone cooldown / daily cap and the global hourly cap. A resend
    // after the cooldown simply replaces the previous code.
    await this.reserveOtpSend(phone);

    // Generate 6-digit code; store ONLY its HMAC hash (C1/C2 remediation)
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = this.hashOtp(phone, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // H5: deliver FIRST. The OTP row is only written once the SMS gateway
    // accepted the message, so a failed send never leaves a live code behind.
    try {
      await this.smsGateway.sendOtp(phone, code);
    } catch (error) {
      this.logger.error(
        `OTP delivery failed for ${phone.slice(0, 3)}******${phone.slice(-2)}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'We could not send the verification code right now. Please try again shortly.',
      );
    }

    await this.prisma.oTP.upsert({
      where: { phone },
      update: {
        code: codeHash,
        purpose: dto.purpose,
        attempts: 0,
        expiresAt,
        verifiedAt: null,
      },
      create: {
        phone,
        code: codeHash,
        purpose: dto.purpose || 'login',
        expiresAt,
      },
    });

    return {
      status: 'sent',
      phone,
      expiresInSeconds: 600,
      // Dev-only: return the code so it can be tested without an SMS gateway
      ...(env.OTP_DEBUG_ECHO === 'true' ? { code } : {}),
    };
  }

  /**
   * H5: reserve one OTP send for `phone`, or throw.
   *  - 1 send per 30 s per phone (429)
   *  - 5 sends per 24 h per phone (429)
   *  - OTP_GLOBAL_HOURLY_CAP sends per hour overall (503, logged as an error)
   * Uses Redis when it is ready (atomic Lua script), otherwise counts rows in
   * `otp_sends` under a per-phone advisory lock.
   */
  private async reserveOtpSend(phone: string): Promise<void> {
    const cap = env.OTP_GLOBAL_HOURLY_CAP;
    const cooldown = AuthService.OTP_RESEND_COOLDOWN_SECONDS;
    const dailyMax = AuthService.OTP_MAX_SENDS_PER_DAY;

    let verdict: 'ok' | 'cooldown' | 'daily' | 'global' | null = null;

    if (this.redis && this.redis.status === 'ready') {
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const script = `
        if redis.call('EXISTS', KEYS[1]) == 1 then return 1 end
        local g = tonumber(redis.call('GET', KEYS[3]) or '0')
        if g >= tonumber(ARGV[5]) then return 3 end
        local d = tonumber(redis.call('GET', KEYS[2]) or '0')
        if d >= tonumber(ARGV[3]) then return 2 end
        redis.call('SET', KEYS[1], '1', 'EX', ARGV[1])
        local fresh = redis.call('INCR', KEYS[2]) == 1
        if fresh then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
        if redis.call('INCR', KEYS[3]) == 1 then redis.call('EXPIRE', KEYS[3], ARGV[4]) end
        if fresh then return 4 end
        return 0
      `;
      const cooldownKey = `weyro:otp:send:cooldown:${phone}`;
      const dailyKey = `weyro:otp:send:daily:${phone}`;
      const globalKey = `weyro:otp:send:global:${hourBucket}`;
      let freshDaily = false;
      try {
        const result = Number(
          await this.redis.eval(
            script,
            3,
            cooldownKey,
            dailyKey,
            globalKey,
            String(cooldown),
            '86400',
            String(dailyMax),
            '3660',
            String(cap),
          ),
        );
        // 4 = ok, and the daily counter was just created (first send in 24 h, or Redis lost it).
        freshDaily = result === 4;
        verdict = (['ok', 'cooldown', 'daily', 'global'] as const)[result] ?? 'ok';
      } catch (error) {
        this.logger.warn(
          `Redis OTP send limiter unavailable, using database counts: ${(error as Error).message}`,
        );
      }
      if (verdict === 'ok') {
        verdict = await this.reconcileOtpSendWithDb(phone, freshDaily, { cooldownKey, dailyKey, globalKey });
      }
    }

    if (verdict === null) {
      verdict = await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent sends for the same phone.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp-send:${phone}`}))`;
        const now = Date.now();
        const [recent, today, thisHour] = await Promise.all([
          tx.otpSend.count({ where: { phone, createdAt: { gte: new Date(now - cooldown * 1000) } } }),
          tx.otpSend.count({ where: { phone, createdAt: { gte: new Date(now - 24 * 3_600_000) } } }),
          tx.otpSend.count({ where: { createdAt: { gte: new Date(now - 3_600_000) } } }),
        ]);
        if (recent > 0) return 'cooldown' as const;
        if (thisHour >= cap) return 'global' as const;
        if (today >= dailyMax) return 'daily' as const;
        await tx.otpSend.create({ data: { phone } });
        // Keep the log small: drop rows older than the longest window we use.
        if (crypto.randomInt(0, 50) === 0) {
          await tx.otpSend.deleteMany({
            where: { createdAt: { lt: new Date(now - 48 * 3_600_000) } },
          });
        }
        return 'ok' as const;
      });
    }

    if (verdict === 'cooldown') {
      throw new HttpException(
        `Please wait ${cooldown} seconds before requesting another code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (verdict === 'daily') {
      throw new HttpException(
        'Too many verification codes requested for this number. Try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (verdict === 'global') {
      this.logger.error(
        `OTP global hourly cap (${cap}) reached — refusing new sends. Possible SMS pumping attack; investigate.`,
      );
      throw new ServiceUnavailableException(
        'Verification codes are temporarily unavailable. Please try again later.',
      );
    }
  }

  /**
   * Redis path, after the script allowed a send. If the daily counter is new,
   * restore it from `otp_sends` so a Redis flush can't reset the per-phone cap
   * (one indexed count, only on the first send per phone per 24 h). Then
   * mirror the send into `otp_sends` as a durable log. Both steps are
   * best-effort: a database error is logged and the send goes ahead.
   */
  private async reconcileOtpSendWithDb(
    phone: string,
    freshDaily: boolean,
    { cooldownKey, dailyKey, globalKey }: { cooldownKey: string; dailyKey: string; globalKey: string },
  ): Promise<'ok' | 'daily'> {
    if (freshDaily) {
      try {
        const today = await this.prisma.otpSend.count({
          where: { phone, createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
        });
        if (today > 0) {
          await this.redis!.set(dailyKey, String(today + 1), 'EX', 86400);
        }
        if (today >= AuthService.OTP_MAX_SENDS_PER_DAY) {
          // This send is refused: don't count it globally, and drop the cooldown the
          // script set so a retry gets the daily message, not "wait 30 seconds".
          await this.redis!.decr(globalKey);
          await this.redis!.del(cooldownKey);
          return 'daily';
        }
      } catch (error) {
        this.logger.error(`OTP daily-cap reconcile failed: ${(error as Error).message}`);
      }
    }
    try {
      await this.prisma.otpSend.create({ data: { phone } });
      // Same pruning as the database branch, which rarely runs while Redis is up.
      if (crypto.randomInt(0, 50) === 0) {
        await this.prisma.otpSend.deleteMany({
          where: { createdAt: { lt: new Date(Date.now() - 48 * 3_600_000) } },
        });
      }
    } catch (error) {
      this.logger.error(`OTP send log write failed: ${(error as Error).message}`);
    }
    return 'ok';
  }

  /**
   * Verify a 6-digit OTP and optionally mark the phone as verified.
   * On successful verification for login/register, returns JWT tokens.
   */
  /**
   * Per-phone sliding-window gate for verify-otp. Uses an atomic Redis
   * sorted-set when available so N replicas enforce one shared limit; falls
   * back to the in-process map only when Redis is not configured.
   */
  private async assertPhoneVerifyAllowance(phone: string): Promise<void> {
    if (this.redis && this.redis.status === 'ready') {
      const key = `weyro:otp:verify:${phone}`;
      const now = Date.now();
      const windowMs = AuthService.VERIFY_WINDOW_MS;
      const script = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local max = tonumber(ARGV[3])
        redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
        local count = redis.call('ZCARD', key)
        if count >= max then return 0 end
        redis.call('ZADD', key, now, ARGV[4])
        redis.call('PEXPIRE', key, window)
        return 1
      `;
      try {
        const allowed = await this.redis.eval(
          script,
          1,
          key,
          String(now),
          String(windowMs),
          String(AuthService.VERIFY_MAX_PER_WINDOW),
          `${now}:${crypto.randomBytes(6).toString('hex')}`,
        );
        if (Number(allowed) === 0) {
          throw new BadRequestException(
            'Too many verification attempts for this number. Please wait a minute and try again.',
          );
        }
        return;
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        this.logger.warn(
          `Redis OTP throttle unavailable, falling back to local window: ${(error as Error).message}`,
        );
      }
    }

    const now = Date.now();
    const window = this.verifyAttemptsByPhone.get(phone) ?? [];
    const recent = window.filter((t) => now - t < AuthService.VERIFY_WINDOW_MS);
    if (recent.length >= AuthService.VERIFY_MAX_PER_WINDOW) {
      throw new BadRequestException(
        'Too many verification attempts for this number. Please wait a minute and try again.',
      );
    }
    recent.push(now);
    this.verifyAttemptsByPhone.set(phone, recent);

    // Opportunistic cleanup to keep the map bounded
    if (this.verifyAttemptsByPhone.size > 10_000) {
      for (const [key, times] of this.verifyAttemptsByPhone) {
        if (!times.some((t) => now - t < AuthService.VERIFY_WINDOW_MS)) {
          this.verifyAttemptsByPhone.delete(key);
        }
      }
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = dto.phone.trim();
    // M2: phone-scoped rate limit BEFORE any DB work
    await this.assertPhoneVerifyAllowance(phone);

    const otp = await this.prisma.oTP.findUnique({
      where: { phone },
    });

    if (!otp) {
      throw new BadRequestException('No OTP found for this phone number');
    }

    if (otp.verifiedAt) {
      throw new BadRequestException('OTP has already been verified');
    }

    // A recovery code must never double as a login credential.
    if (otp.purpose === 'reset_password') {
      throw new BadRequestException('OTP is not valid for this action');
    }

    if (dto.purpose && otp.purpose && dto.purpose !== otp.purpose) {
      throw new BadRequestException('OTP is not valid for this action');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    // NOTE: no pre-read attempts check here — the ceiling is enforced
    // atomically by the conditional updateMany gate below (C2 fix).

    // Increment attempts ATOMICALLY (C2): conditional updateMany on the
    // attempts ceiling so a concurrent guess race cannot bypass the limit.
    // If the gate returns 0 rows something raced past the ceiling — lockout.
    const gate = await this.prisma.oTP.updateMany({
      where: {
        phone,
        verifiedAt: null,
        attempts: { lt: otp.maxAttempts },
      },
      data: { attempts: { increment: 1 } },
    });

    if (gate.count === 0) {
      // Invalidate the record entirely once the ceiling is hit.
      await this.prisma.oTP.deleteMany({ where: { phone, verifiedAt: null } });
      throw new BadRequestException(
        'Maximum OTP verification attempts exceeded',
      );
    }

    if (!this.otpMatches(phone, dto.code, otp.code)) {
      throw new BadRequestException('Invalid OTP code');
    }

    // Mark OTP as verified
    await this.prisma.oTP.update({
      where: { phone },
      data: { verifiedAt: new Date() },
    });

    // Find or create user by phone
    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        customerProfile: true,
        providerProfile: true,
      },
    });

    if (user && (!user.isActive || user.deletedAt)) {
      throw new UnauthorizedException('This account is disabled');
    }

    const isNewUser = !user;

    if (isNewUser) {
      // Auto-create a customer-profile user for OTP-based login
      user = await this.prisma.user.create({
        data: {
          phone,
          passwordHash: '', // OTP-authenticated users have no password
          role: 'CUSTOMER',
          phoneVerified: true,
          customerProfile: {
            create: {
              firstName: 'Customer',
              lastName: '',
            },
          },
        },
        include: {
          customerProfile: true,
          providerProfile: true,
        },
      });
    } else if (!user!.phoneVerified) {
      // H1: this phone was claimed by a password registration that never
      // proved ownership (possible pre-takeover). The OTP holder is the real
      // owner: drop the claimant's password and kill every session they hold.
      const existing = user!;
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: existing.id },
          data: { phoneVerified: true, passwordHash: '' },
        }),
        this.prisma.refreshToken.updateMany({
          where: { userId: existing.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      user = { ...existing, phoneVerified: true, passwordHash: '' };
    }

    const tokens = await this.generateTokenPair(user as any);

    return {
      status: 'verified',
      isNewUser,
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Reset a user's password after OTP verification (purpose: 'reset_password').
   * Verifies the OTP, then updates the password hash and marks the OTP as used.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const phone = dto.phone.trim();

    const otp = await this.prisma.oTP.findUnique({
      where: { phone },
    });

    if (!otp) {
      throw new BadRequestException('No OTP found for this phone number');
    }

    if (otp.verifiedAt) {
      throw new BadRequestException('OTP has already been used');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    if (otp.purpose !== 'reset_password') {
      throw new BadRequestException('OTP was not issued for password reset');
    }

    const gate = await this.prisma.oTP.updateMany({
      where: {
        phone,
        verifiedAt: null,
        purpose: 'reset_password',
        attempts: { lt: otp.maxAttempts },
      },
      data: { attempts: { increment: 1 } },
    });

    if (gate.count === 0) {
      await this.prisma.oTP.deleteMany({ where: { phone, verifiedAt: null } });
      throw new BadRequestException(
        'Maximum OTP verification attempts exceeded',
      );
    }

    if (!this.otpMatches(phone, dto.code, otp.code)) {
      throw new BadRequestException('Invalid OTP code');
    }

    const user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      // Same error as a wrong code: the response must not reveal whether an
      // account exists for this phone number.
      throw new BadRequestException('Invalid OTP code');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.oTP.update({
        where: { phone },
        data: { verifiedAt: new Date() },
      }),
      // A password reset must terminate every existing session.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { status: 'reset', phone };
  }

  private async generateTokenPair(
    user: {
      id: string;
      email: string | null;
      phone: string;
      role: any;
      customerProfile?: { id: string } | null;
      providerProfile?: { id: string; verificationStatus?: any } | null;
    },
    tx?: any,
    familyId?: string,
  ) {
    const payload: AuthUserPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      phone: user.phone,
      role: user.role,
      customerProfileId: user.customerProfile?.id,
      providerProfileId: user.providerProfile?.id,
      verificationStatus: user.providerProfile?.verificationStatus,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = this.refreshTokenExpiry();

    const db = tx || this.prisma;
    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        // Fresh login: the minted token is its own rotation-family root.
        // Rotation ("refresh"): the new token inherits the existing family.
        familyId: familyId || crypto.randomUUID(),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private refreshTokenExpiry(): Date {
    const raw = env.JWT_REFRESH_EXPIRES_IN;
    const match = /^(\d+)([smhd])$/.exec(raw);

    if (!match) {
      throw new Error(
        `Invalid JWT_REFRESH_EXPIRES_IN value: "${raw}". Use e.g. 7d, 12h, 30m.`,
      );
    }

    const value = Number(match[1]);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return new Date(Date.now() + value * unitMs[match[2]]);
  }

  private sanitizeUser(user: any) {
    // exclusions for token/secret columns — kept explicit for future dates
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, refreshTokens, ...sanitized } = user;
    return sanitized;
  }
}
