import { RefreshTokenPayload } from '@common/types/jwt.types';
import {
  hashPassword,
  hashValue,
  verifyPassword,
  verifyValue,
} from '@common/utils/crypto';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@common/utils/jwt';
import { User } from '@db/browser';
import { LoginDto } from '@modules/auth/dto/login.dto';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  private readonly refreshExpiresInMs: number;
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.refreshExpiresInMs =
      Number(configService.getOrThrow('JWT_REFRESH_EXPIRES_IN_SECONDS')) * 1000;
  }

  async registerUser(
    registerDto: RegisterDto,
    ip?: string,
    userAgent?: string,
  ): Promise<Tokens> {
    const { password, ...userData } = registerDto;
    const passwordHash = await hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        passwordHash,
      },
    });

    this.logger.log({ msg: 'User registered', userId: user.id });

    return await this.loginUser(user, ip, userAgent);
  }

  async validateUser(loginDto: LoginDto): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    const isPasswordValid =
      user && (await verifyPassword(loginDto.password, user.passwordHash));

    if (!user || !isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  async loginUser(
    user: User,
    ip?: string,
    userAgent?: string,
  ): Promise<Tokens> {
    const sessionId = crypto.randomUUID();
    const tokens = this.generateTokens(user, sessionId);

    const refreshTokenHash = await hashValue(tokens.refreshToken);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + this.refreshExpiresInMs),
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return tokens;
  }

  async refreshSession(refreshToken: string): Promise<Tokens> {
    const payload = this.validateRefreshToken(refreshToken);

    const session = await this.prisma.session.findFirst({
      where: { id: payload.sid, revoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const isHashValid = await verifyValue(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!isHashValid) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revoked: true },
      });
      throw new UnauthorizedException(
        'Invalid refresh token - session revoked',
      );
    }

    const newTokens = this.generateTokens(session.user, session.id);
    const newHash = await hashValue(newTokens.refreshToken);

    const { count } = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: session.refreshTokenHash,
      },
      data: {
        refreshTokenHash: newHash,
        expiresAt: new Date(Date.now() + this.refreshExpiresInMs),
      },
    });

    if (count === 0) {
      throw new UnauthorizedException('Refresh token already used');
    }

    return newTokens;
  }

  private validateRefreshToken(refreshToken: string): RefreshTokenPayload {
    try {
      return verifyRefreshToken(refreshToken, this.configService);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(user: User, sessionId: string): Tokens {
    const payload = {
      sub: user.id,
      role: user.role,
      sid: sessionId,
    };

    return {
      accessToken: signAccessToken(payload, this.configService),
      refreshToken: signRefreshToken(payload, this.configService),
    };
  }
}
