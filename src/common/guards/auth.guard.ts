import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { AuthRequest } from '@common/types/auth-request.types';
import { verifyAccessToken } from '@common/utils/jwt';
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
  ) {}
  canActivate(context: ExecutionContext): boolean {
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
      request.user = payload;
      request.log = request.log.child({ userId: payload.sub });
    } catch {
      throw new UnauthorizedException('Access token invalid or expired');
    }
    return true;
  }

  private extractTokenFromHeader(request: AuthRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
