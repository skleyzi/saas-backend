import { AuthRequest } from '@common/types/auth-request.types';
import { AccessTokenPayload } from '@common/types/jwt.types';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: keyof AccessTokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!user) return undefined;

    return data ? user[data] : user;
  },
);
