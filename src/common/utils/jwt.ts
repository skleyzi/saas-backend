import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '@common/types/jwt.types';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

export const signAccessToken = (
  payload: AccessTokenPayload,
  configService: ConfigService,
) => {
  return jwt.sign(
    payload,
    configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    {
      expiresIn: Number(
        configService.getOrThrow('JWT_ACCESS_EXPIRES_IN_SECONDS'),
      ),
    },
  );
};

export const verifyAccessToken = (
  token: string,
  configService: ConfigService,
): AccessTokenPayload => {
  return jwt.verify(
    token,
    configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
  ) as unknown as AccessTokenPayload;
};

export const signRefreshToken = (
  payload: RefreshTokenPayload,
  configService: ConfigService,
) => {
  return jwt.sign(
    payload,
    configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    {
      expiresIn: Number(
        configService.getOrThrow('JWT_REFRESH_EXPIRES_IN_SECONDS'),
      ),
    },
  );
};

export const verifyRefreshToken = (
  refreshToken: string,
  configService: ConfigService,
): RefreshTokenPayload => {
  return jwt.verify(
    refreshToken,
    configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
  ) as unknown as RefreshTokenPayload;
};
