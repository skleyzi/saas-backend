import { verifyAccessToken } from '@common/utils/jwt';
import { ConfigService } from '@nestjs/config';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

export async function registerAndLogin(
  app: NestFastifyApplication,
  override = {},
) {
  const dto = {
    email: `test_${Date.now()}@example.com`,
    password: 'str0ngPa$$word',
    name: 'Test User',
    ...override,
  };

  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: dto,
  });

  const body = JSON.parse(res.payload);
  const configService = app.get(ConfigService);
  const payload = verifyAccessToken(body.accessToken, configService);

  return {
    accessToken: body.accessToken,
    cookie: res.headers['set-cookie'] as string,
    userId: payload.sub,
  };
}
