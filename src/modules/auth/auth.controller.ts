import { Public } from '@common/decorators/public.decorator';
import { getRefreshTokenCookieOptions } from '@common/utils/auth.constants';
import { AuthService } from '@modules/auth/auth.service';
import { LoginDto } from '@modules/auth/dto/login.dto';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async registerUser(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.registerUser(dto);

    res.setCookie(
      'refresh_token',
      refreshToken,
      getRefreshTokenCookieOptions(),
    );

    return { accessToken };
  }

  @Public()
  @Post('login')
  async loginUser(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const user = await this.authService.validateUser(dto);
    const { accessToken, refreshToken } =
      await this.authService.loginUser(user);

    res.setCookie(
      'refresh_token',
      refreshToken,
      getRefreshTokenCookieOptions(),
    );

    return { accessToken };
  }

  @Public()
  @Post('refresh')
  async refreshSession(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const oldRefreshToken = req.cookies['refresh_token'];
    if (!oldRefreshToken)
      throw new UnauthorizedException('Refresh token missing');

    const { accessToken, refreshToken } =
      await this.authService.refreshSession(oldRefreshToken);

    res.setCookie(
      'refresh_token',
      refreshToken,
      getRefreshTokenCookieOptions(),
    );

    return { accessToken };
  }
}
