import { Plan } from '@db/client';
import { SubscriptionStatus } from '@db/enums';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import {
  cleanDb,
  prisma,
  seedPlan,
  seedResource,
  seedSubscription,
} from './helpers/db.helper';

describe('Resources (e2e)', () => {
  let app: NestFastifyApplication;
  let token: string;
  let userId: string;
  let plan: Plan;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await cleanDb();
    const auth = await registerAndLogin(app);
    token = auth.accessToken;
    userId = auth.userId;

    plan = await seedPlan();
    await seedSubscription(userId, plan.id);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /resources', () => {
    it('should create a new resource with active subscription', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/resources',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Test Resource' },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toHaveProperty('id');
      expect(JSON.parse(response.payload)).toHaveProperty('title');
    });

    it('should return 402 if user has no active subscription', async () => {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { status: SubscriptionStatus.CANCELED },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/resources',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: { title: 'Test Resource' },
      });

      expect(response.statusCode).toBe(402);
    });

    it('should return 403 at plan limit', async () => {
      await prisma.resource.createMany({
        data: Array.from({ length: plan.maxResources }, (_, i) => ({
          title: `Test Resource ${i + 1}`,
          userId,
        })),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/resources',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: { title: 'Test Resource' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /resources/:id', () => {
    it('should return resource', async () => {
      const resource = await seedResource(userId);

      const response = await app.inject({
        method: 'GET',
        url: `/resources/${resource.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('id');
      expect(JSON.parse(response.payload)).toHaveProperty('title');
    });

    it('should return 404 for other user resource', async () => {
      const other = await registerAndLogin(app);
      await seedSubscription(other.userId, plan.id);
      const otherResource = await seedResource(other.userId);

      const response = await app.inject({
        method: 'GET',
        url: `/resources/${otherResource.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /resources/:id', () => {
    it('should update resource', async () => {
      const resource = await seedResource(userId);

      const response = await app.inject({
        method: 'PATCH',
        url: `/resources/${resource.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated Test Resource' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('id');
      expect(JSON.parse(response.payload)).toHaveProperty('title');
    });

    it('should return 404 for other user resource', async () => {
      const other = await registerAndLogin(app);
      await seedSubscription(other.userId, plan.id);
      const otherResource = await seedResource(other.userId);

      const response = await app.inject({
        method: 'PATCH',
        url: `/resources/${otherResource.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated Test Resource' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /resources/:id', () => {
    it('should delete resource', async () => {
      const resource = await seedResource(userId);

      const response = await app.inject({
        method: 'DELETE',
        url: `/resources/${resource.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for other user resource', async () => {
      const other = await registerAndLogin(app);
      await seedSubscription(other.userId, plan.id);
      const otherResource = await seedResource(other.userId);

      const response = await app.inject({
        method: 'DELETE',
        url: `/resources/${otherResource.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
