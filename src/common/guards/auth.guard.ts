import { AccessTokenPayload } from '@common/types/jwt.types';
import { verifyAccessToken } from '@common/utils/jwt';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token missing');
    }

    try {
      const payload = verifyAccessToken(token);
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Access token invalid or expired');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
