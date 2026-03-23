import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { AuthRequest } from '@common/types/auth-request.types';
import { verifyAccessToken } from '@common/utils/jwt';
import { UsersService } from '@modules/users/users.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token missing');
    }

    try {
      const payload = verifyAccessToken(token, this.configService);

      const user = await this.usersService
        .findById(payload.sub)
        .catch(() => null);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User is inactive or not found');
      }

      request.user = { ...user, sid: payload.sid };
      request.log = request.log.child({ userId: user.id });
    } catch (e) {
      throw new UnauthorizedException(
        e instanceof UnauthorizedException
          ? e.message
          : 'Access token invalid or expired',
      );
    }
    return true;
  }

  private extractTokenFromHeader(request: AuthRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
