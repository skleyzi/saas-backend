import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '@common/types/jwt.types';
import jwt from 'jsonwebtoken';

export const signAccessToken = (payload: AccessTokenPayload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: Number(process.env.JWT_ACCESS_EXPIRES_IN_SECONDS),
  });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET!,
  ) as unknown as AccessTokenPayload;
};

export const signRefreshToken = (payload: RefreshTokenPayload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS),
  });
};

export const verifyRefreshToken = (
  refreshToken: string,
): RefreshTokenPayload => {
  return jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_SECRET!,
  ) as unknown as RefreshTokenPayload;
};
