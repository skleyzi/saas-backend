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

describe('Webhook (e2e)', () => {
  let app: NestFastifyApplication;
  let userId: string;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await cleanDb();
    const auth = await registerAndLogin(app);
    userId = auth.userId;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function sendWebhookEvent(event: object) {
    return await app.inject({
      method: 'POST',
      url: '/webhook/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'test_signature',
      },
      payload: event,
    });
  }

  describe('POST /webhook/stripe', () => {
    it('should skip duplicate events', async () => {
      const event = {
        id: 'evt_duplicate',
        type: 'checkout.session.expired',
        data: { object: {} },
      };

      await sendWebhookEvent(event);
      const res = await sendWebhookEvent(event);

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ skipped: true });
    });

    it('should mark subscription as canceled on customer.subscription.deleted', async () => {
      const plan = await seedPlan();
      const sub = await seedSubscription(userId, plan.id);

      const event = {
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        data: { object: { id: sub.stripeSubscriptionId } },
      };

      await sendWebhookEvent(event);

      const subUpdated = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: sub.stripeSubscriptionId },
      });

      expect(subUpdated?.status).toBe(SubscriptionStatus.CANCELED);
    });
  });
});
