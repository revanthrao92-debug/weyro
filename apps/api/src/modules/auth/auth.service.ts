import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          passwordHash: 'hashed_credential_secret',
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
                    description: 'Automotive service & parts specialist',
                    phone: dto.phone,
                    address: dto.address || 'Central City',
                    latitude: dto.latitude || 40.7128,
                    longitude: dto.longitude || -74.006,
                  },
                }
              : undefined,
        },
        include: {
          customerProfile: true,
          providerProfile: true,
        },
      });

      return {
        user,
        accessToken: `jwt_demo_${user.id}_${Date.now()}`,
      };
    } catch {
      // In-memory mock response for dev environment
      return {
        user: {
          id: `usr_${Date.now()}`,
          email: dto.email,
          phone: dto.phone,
          role: dto.role,
        },
        accessToken: `jwt_demo_${Date.now()}`,
      };
    }
  }

  async login(dto: LoginDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: {
          customerProfile: true,
          providerProfile: true,
        },
      });

      if (user) {
        return {
          user,
          accessToken: `jwt_demo_${user.id}_${Date.now()}`,
        };
      }
    } catch {
      // fallback
    }

    return {
      user: {
        id: 'usr_demo_01',
        email: dto.email,
        phone: '+15550192834',
        role: 'CUSTOMER',
      },
      accessToken: `jwt_demo_${Date.now()}`,
    };
  }

  async getMe(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          customerProfile: true,
          providerProfile: true,
        },
      });
    } catch {
      return {
        id: userId,
        email: 'customer@weyro.com',
        role: 'CUSTOMER',
      };
    }
  }
}
