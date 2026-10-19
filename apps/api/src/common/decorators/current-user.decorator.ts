import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUserPayload } from '../types/auth-user-payload.type';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUserPayload = request.user;
    if (!user) {
      return null;
    }
    return data ? user[data] : user;
  },
);
