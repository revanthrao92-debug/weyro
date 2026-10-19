import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@weyro/api-contracts';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUserPayload } from '../types/auth-user-payload.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthUserPayload = request.user;

    if (!user) {
      throw new ForbiddenException('User authentication required for role verification');
    }

    // ADMIN has platform-wide authority
    if (user.role === 'ADMIN') {
      return true;
    }

    const hasRole = requiredRoles.some((role) => {
      if (user.role === role) return true;
      // BOTH role satisfies CUSTOMER or PROVIDER requirements
      if (user.role === 'BOTH' && (role === 'CUSTOMER' || role === 'PROVIDER')) {
        return true;
      }
      return false;
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
