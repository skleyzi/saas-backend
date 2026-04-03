import { SubscriptionStatus } from '@db/enums';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import {
  cleanDb,
  prisma,
  seedPlan,
  seedSubscription,
} from './helpers/db.helper';

describe('Billing (e2e)', () => {
  let app: NestFastifyApplication;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await cleanDb();
    const auth = await registerAndLogin(app);
    token = auth.accessToken;
    userId = auth.userId;

    const plan = await seedPlan();
    await seedSubscription(userId, plan.id);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /billing/plans', () => {
    it('should return active plans', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/billing/plans',
      });

      expect(response.statusCode).toBe(200);
      const plans = JSON.parse(response.payload);
      expect(plans.length).toBe(1);
      expect(plans[0]).toHaveProperty('id');
      expect(plans[0]).toHaveProperty('name');
    });

    it('should not return inactive plans', async () => {
      await prisma.plan.updateMany({ data: { isActive: false } });

      const response = await app.inject({
        method: 'GET',
        url: '/billing/plans',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual([]);
    });
  });

  describe('GET /billing/subscription', () => {
    it("should return the user's subscription information", async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/billing/subscription',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const sub = JSON.parse(response.payload);
      expect(sub).toHaveProperty('id');
      expect(sub).toHaveProperty('status');
      expect(sub).toHaveProperty('plan');
    });

    it('should return 404 if the user has no active subscription', async () => {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { status: SubscriptionStatus.CANCELED },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/billing/subscription',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
