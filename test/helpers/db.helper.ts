import { BillingInterval, PrismaClient, SubscriptionStatus } from '@db/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });

export async function cleanDb() {
  await prisma.webhookEvent.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.session.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedUser(
  override: Partial<{
    email: string;
    name: string;
    passwordHash: string;
    isActive: boolean;
    role: 'USER' | 'ADMIN';
    stripeCustomerId: string;
  }> = {},
) {
  return await prisma.user.create({
    data: {
      email: `test_${Date.now()}@example.com`,
      name: 'Test User',
      passwordHash: 'test_password_hash',
      isActive: true,
      ...override,
    },
  });
}

export async function seedPlan(
  override: Partial<{
    name: string;
    priceInCents: number;
    maxResources: number;
    isActive: boolean;
  }> = {},
) {
  return await prisma.plan.create({
    data: {
      name: 'Test Plan',
      priceInCents: 1000,
      currency: 'usd',
      interval: BillingInterval.MONTH,
      intervalCount: 1,
      stripePriceId: `price_test_${Date.now()}`,
      stripeProductId: `prod_test_${Date.now()}`,
      maxResources: 3,
      isActive: true,
      ...override,
    },
  });
}

export async function seedSubscription(
  userId: string,
  planId: string,
  override: Partial<{
    status: SubscriptionStatus;
    cancelAt: Date | null;
  }> = {},
) {
  return await prisma.subscription.create({
    data: {
      userId,
      planId,
      stripeSubscriptionId: `sub_test_${Date.now()}`,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAt: null,
      ...override,
    },
  });
}

export async function seedResource(
  userId: string,
  override: Partial<{
    title: string;
    content: string;
  }> = {},
) {
  return await prisma.resource.create({
    data: {
      title: 'Test Resource',
      content: 'Test Content',
      userId,
      ...override,
    },
  });
}
