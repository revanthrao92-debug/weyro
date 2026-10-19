import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { env } from '../../config/env.config';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

// Pre-computed bcrypt hash for constant-time comparison when user does not exist
const DUMMY_HASH =
  '$2b$12$K8pYtLqZ1mK1qUuV5gD0e.2f7u0v2z9eY5l1s5h3m2w4v6k8q0z7a';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();

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
                  latitude: dto.latitude ?? 12.9716,
                  longitude: dto.longitude ?? 77.5946,
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

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

  private sanitizeUser(user: any) {
    const { passwordHash, refreshTokens, ...sanitized } = user;
    return sanitized;
  }
}
