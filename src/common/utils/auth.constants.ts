export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS) * 1000,
});
