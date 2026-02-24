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
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async registerUser(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.registerUser(dto);

    res.cookie('refresh_token', refreshToken, getRefreshTokenCookieOptions());

    return { accessToken };
  }

  @Public()
  @Post('login')
  async loginUser(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto);
    const { accessToken, refreshToken } =
      await this.authService.loginUser(user);

    res.cookie('refresh_token', refreshToken, getRefreshTokenCookieOptions());

    return { accessToken };
  }

  @Public()
  @Post('refresh')
  async refreshSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefreshToken = req.cookies['refresh_token'];
    if (!oldRefreshToken)
      throw new UnauthorizedException('Refresh token missing');

    const { accessToken, refreshToken } =
      await this.authService.refreshSession(oldRefreshToken);

    res.cookie('refresh_token', refreshToken, getRefreshTokenCookieOptions());

    return { accessToken };
  }
}
