import { AccessTokenPayload } from '@common/types/jwt.types';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: keyof AccessTokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AccessTokenPayload;
    return data ? user[data] : user;
  },
);
