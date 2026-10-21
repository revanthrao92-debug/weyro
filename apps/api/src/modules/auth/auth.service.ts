import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { env } from '../../config/env.config';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

// Pre-computed bcrypt hash for constant-time comparison when user does not exist
const DUMMY_HASH =
  '$2b$12$K8pYtLqZ1mK1qUuV5gD0e.2f7u0v2z9eY5l1s5h3m2w4v6k8q0z7a';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
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

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
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
                  businessName: dto.businessName || 'Auto Service Provider',
                  providerType: dto.providerType || 'MECHANIC',
                  description:
                    dto.description || 'Automotive service & parts specialist',
                  phone,
                  address: dto.address || 'Bengaluru, Karnataka',
                  latitude: dto.latitude as number,
                  longitude: dto.longitude as number,
                  verificationStatus: 'PENDING',
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
    const rawTerm = dto.emailOrPhone || dto.email || '';
    const term = rawTerm.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: term }, { phone: rawTerm.trim() }],
      },
      include: {
        customerProfile: true,
        providerProfile: true,
      },
    });

    // Constant-time check to prevent timing attacks
    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !isPasswordValid || !user.isActive) {
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

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
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

    // Rotate token atomically: revoke current and issue a new one
    const newTokens = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      return await this.generateTokenPair(storedToken.user, tx);
    });

    return {
      user: this.sanitizeUser(storedToken.user),
      ...newTokens,
    };
  }

  async logout(userId: string, refreshTokenStr?: string) {
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
   * Send a 6-digit OTP to the user's phone.
   * In production this would integrate with an SMS gateway (Twilio, MSG91, etc.).
   * For now, the code is stored in the DB and can be retrieved in test/dev.
   */
  async sendOtp(dto: SendOtpDto) {
    const phone = dto.phone.trim();

    // Check if an OTP already exists and hasn't expired
    const existing = await this.prisma.oTP.findUnique({
      where: { phone },
    });

    if (existing && existing.expiresAt > new Date() && !existing.verifiedAt) {
      // Resend not allowed within the same validity window
      throw new BadRequestException(
        'An OTP has already been sent to this number. Please wait for it to expire.',
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oTP.upsert({
      where: { phone },
      update: {
        code,
        purpose: dto.purpose,
        attempts: 0,
        expiresAt,
        verifiedAt: null,
      },
      create: {
        phone,
        code,
        purpose: dto.purpose || 'login',
        expiresAt,
      },
    });

    // In production, send via SMS gateway here
    this.logger.log(
      `OTP for ${phone} (purpose: ${dto.purpose}): ${code}`,
    );

    return {
      status: 'sent',
      phone,
      expiresInSeconds: 600,
      // Dev-only: return the code so it can be tested without an SMS gateway
      ...(env.NODE_ENV !== 'production' ? { code } : {}),
    };
  }

  /**
   * Verify a 6-digit OTP and optionally mark the phone as verified.
   * On successful verification for login/register, returns JWT tokens.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const phone = dto.phone.trim();

    const otp = await this.prisma.oTP.findUnique({
      where: { phone },
    });

    if (!otp) {
      throw new BadRequestException('No OTP found for this phone number');
    }

    if (otp.verifiedAt) {
      throw new BadRequestException('OTP has already been verified');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    if (otp.attempts >= otp.maxAttempts) {
      throw new BadRequestException('Maximum OTP verification attempts exceeded');
    }

    // Increment attempts
    await this.prisma.oTP.update({
      where: { phone },
      data: { attempts: otp.attempts + 1 },
    });

    if (otp.code !== dto.code) {
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

    const isNewUser = !user;

    if (isNewUser) {
      // Auto-create a customer-profile user for OTP-based login
      user = await this.prisma.user.create({
        data: {
          email: `${phone}@weyro.in`, // placeholder email; user can update later
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
    } else {
      // Mark phone as verified for existing users
      await this.prisma.user.update({
        where: { id: user!.id },
        data: { phoneVerified: true },
      });
    }

    const tokens = await this.generateTokenPair(user as any);

    return {
      status: 'verified',
      isNewUser,
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private async generateTokenPair(
    user: {
      id: string;
      email: string;
      phone: string;
      role: any;
      customerProfile?: { id: string } | null;
      providerProfile?: { id: string; verificationStatus?: any } | null;
    },
    tx?: any,
  ) {
    const payload: AuthUserPayload = {
      sub: user.id,
      email: user.email,
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
    const { passwordHash, refreshTokens, ...sanitized } = user;
    return sanitized;
  }
}
