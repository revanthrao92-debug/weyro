import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUserPayload } from '../types/auth-user-payload.type';

/**
 * Enforces provider verification against the database rather than the JWT
 * claim, so admin verification/suspension takes effect immediately.
 */
@Injectable()
export class VerifiedProviderGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthUserPayload | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role === 'ADMIN') {
      return true;
    }

    if (!user.providerProfileId) {
      throw new ForbiddenException('Provider profile required');
    }

    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: user.providerProfileId },
      select: { verificationStatus: true },
    });

    if (provider?.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenException(
        'Only verified providers can perform this action',
      );
    }

    return true;
  }
}
