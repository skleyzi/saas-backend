import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { AuthService } from '@modules/auth/auth.service';
import { AuthResponseDto } from '@modules/auth/dto/auth-response.dto';
import { LoginDto } from '@modules/auth/dto/login.dto';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { minutes, Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';

@Controller('auth')
@Throttle({ default: { limit: 10, ttl: minutes(15) } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  getRefreshTokenCookieOptions() {
    return {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict' as const,
      path: '/auth/refresh',
      maxAge: Number(
        this.configService.getOrThrow('JWT_REFRESH_EXPIRES_IN_SECONDS'),
      ),
    };
  }

  @Public()
  @Post('register')
  async registerUser(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken } = await this.authService.registerUser(
      dto,
      req.ip,
      req.headers['user-agent'],
    );

    res.setCookie(
      'refresh_token',
      refreshToken,
      this.getRefreshTokenCookieOptions(),
    );

    return { accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async loginUser(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthResponseDto> {
    const user = await this.authService.validateUser(dto);
    const { accessToken, refreshToken } = await this.authService.loginUser(
      user,
      req.ip,
      req.headers['user-agent'],
    );

    res.setCookie(
      'refresh_token',
      refreshToken,
      this.getRefreshTokenCookieOptions(),
    );

    return { accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refreshSession(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthResponseDto> {
    const oldRefreshToken = req.cookies['refresh_token'];
    if (!oldRefreshToken)
      throw new UnauthorizedException('Refresh token missing');

    const { accessToken, refreshToken } =
      await this.authService.refreshSession(oldRefreshToken);

    res.setCookie(
      'refresh_token',
      refreshToken,
      this.getRefreshTokenCookieOptions(),
    );

    return { accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser('sid') sid: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.authService.logout(sid);
    res.clearCookie('refresh_token', {
      path: this.getRefreshTokenCookieOptions().path,
    });
  }

  @Post('logout/all')
  @HttpCode(204)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.authService.logoutAll(userId);
    res.clearCookie('refresh_token', {
      path: this.getRefreshTokenCookieOptions().path,
    });
  }
}
