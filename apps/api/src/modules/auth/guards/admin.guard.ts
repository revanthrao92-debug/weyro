import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUserPayload } from '../../../common/types/auth-user-payload.type';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthUserPayload = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Access restricted to administrators');
    }

    return true;
  }
}
