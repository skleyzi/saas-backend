import { AccessTokenPayload } from '@common/types/jwt.types';
import { Role } from '@db/enums';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AccessTokenPayload = request.user;

    if (!user) return false;
    return user.role === Role.ADMIN;
  }
}
