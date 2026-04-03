import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './helpers/app.helper';
import { cleanDb, prisma } from './helpers/db.helper';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;

  const registerDto = {
    email: 'e2e@example.com',
    password: 'str0ngPa$$word',
    name: 'E2E User',
  };

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /auth/register', () => {
    it('should register and return access token and set cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerDto,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('accessToken');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should return 409 on duplicate email', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerDto,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerDto,
      });

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 on missing fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'test@test.com' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerDto,
      });
    });

    it('should login and return access token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: registerDto.email, password: registerDto.password },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveProperty('accessToken');
    });

    it('should return 401 on wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: registerDto.email, password: 'wrongPassword' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 on nonexistent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'nobody@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new access token', async () => {
      const registerRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerDto,
      });

      const cookie = registerRes.headers['set-cookie'] as string;

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveProperty('accessToken');
    });

    it('should return 401 with no cookie', async () => {
      const res = await app.inject({ method: 'POST', url: '/auth/refresh' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout and clear cookie', async () => {
      const registerRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerDto,
      });

      const token = JSON.parse(registerRes.payload).accessToken;
      const cookie = registerRes.headers['set-cookie'] as string;

      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer ${token}`,
          cookie,
        },
      });

      expect(res.statusCode).toBe(204);
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });
});
