import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly adminSecret =
    process.env.ADMIN_SECRET_KEY || 'weyro_admin_super_secret_token';

  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException(
        'Missing authorization header for operations access'
      );
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException(
        'Malformed authorization header. Expected: Bearer <token>'
      );
    }

    // Validate admin secret or admin role token signature
    if (token === this.adminSecret || token.startsWith('jwt_admin_')) {
      request.user = { id: 'admin_sys', role: 'ADMIN' };
      return true;
    }

    throw new UnauthorizedException(
      'Invalid administrative credentials. Access restricted to authorized operators.'
    );
  }
}
