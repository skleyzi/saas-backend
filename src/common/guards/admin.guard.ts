import { AuthRequest } from '@common/types/auth-request.types';
import { Role } from '@db/enums';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!user) return false;
    return user.role === Role.ADMIN;
  }
}
