import { mockConfigService } from '@common/test/mock-config.service';
import { createMockPrismaService } from '@common/test/mock-prisma.service';
import { createMockStripeService } from '@common/test/mock-stripe.service';
import { SubscriptionStatus } from '@db/enums';
import { BillingService } from '@modules/billing/billing.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StripeService } from '@modules/stripe/stripe.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

describe('BillingService', () => {
  let billingService: BillingService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockStripe: ReturnType<typeof createMockStripeService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockStripe = createMockStripeService();

    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StripeService, useValue: mockStripe },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    billingService = module.get<BillingService>(BillingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createCheckoutSession', () => {
    const userId = 'user-id';
    const planId = 'plan-id';

    it('should create a checkout session', async () => {
      const url = 'checkout-url';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptions: [],
      });
      mockStripe.hasActiveSubscription.mockResolvedValue(false);
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: planId,
        isActive: true,
      });
      mockStripe.createCustomer.mockResolvedValue({ id: 'cus-id' });
      mockPrisma.user.update.mockResolvedValue({});
      mockStripe.createCheckoutSession.mockResolvedValue({ url });

      const result = await billingService.createCheckoutSession(userId, planId);
      expect(result).toEqual({ url });
    });

    it('should throw if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        billingService.createCheckoutSession(userId, planId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if user has an active subscription in DB', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptions: [{ status: SubscriptionStatus.ACTIVE }],
      });

      await expect(
        billingService.createCheckoutSession(userId, planId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user has past due subscription in DB', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptions: [{ status: SubscriptionStatus.PAST_DUE }],
      });

      await expect(
        billingService.createCheckoutSession(userId, planId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user has an active subscription in Stripe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        stripeCustomerId: 'cus-id',
        subscriptions: [],
      });
      mockStripe.hasActiveSubscription.mockResolvedValue(true);

      await expect(
        billingService.createCheckoutSession(userId, planId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if plan not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptions: [],
      });
      mockStripe.hasActiveSubscription.mockResolvedValue(false);
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        billingService.createCheckoutSession(userId, planId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCurrentSubscription', () => {
    const userId = 'user-id';
    const subscription = {
      id: 'sub-id',
      subscriptions: [{ status: SubscriptionStatus.ACTIVE }],
      plan: { id: 'plan-id' },
    };

    it('should return current subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(subscription);

      await billingService.getCurrentSubscription(userId);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            status: {
              in: [
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.TRIALING,
                SubscriptionStatus.PAST_DUE,
              ],
            },
          },
          include: { plan: true },
        }),
      );
    });

    it('should throw if subscription not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        billingService.getCurrentSubscription(userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listPlans', () => {
    it('should return active plans', async () => {
      const plans = [{ id: 'plan-id-1', isActive: true }];
      mockPrisma.plan.findMany.mockResolvedValue(plans);

      const result = await billingService.listPlans();
      expect(result).toEqual(plans);
    });

    it('should return empty array when no plans exist', async () => {
      mockPrisma.plan.findMany.mockResolvedValue([]);

      const result = await billingService.listPlans();
      expect(result).toEqual([]);
    });
  });

  describe('cancelSubscription', () => {
    const userId = 'user-id';
    const subscriptionId = 'sub-id';

    it('should initiate subscription cancel', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
      });

      await billingService.cancelSubscription(userId, subscriptionId);
      expect(mockStripe.cancelSubscription).toHaveBeenCalledWith(
        subscriptionId,
      );
    });

    it('should throw if subscription not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        billingService.cancelSubscription(userId, subscriptionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if subscription is canceled', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.CANCELED,
      });

      await expect(
        billingService.cancelSubscription(userId, subscriptionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if subscription is already scheduled for cancellation', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        cancelAt: new Date(),
      });

      await expect(
        billingService.cancelSubscription(userId, subscriptionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if stripe failed to cancel subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
      });
      mockStripe.cancelSubscription.mockRejectedValue(new Error());

      await expect(
        billingService.cancelSubscription(userId, subscriptionId),
      ).rejects.toThrow(BadRequestException);
      expect(mockStripe.cancelSubscription).toHaveBeenCalledWith(
        subscriptionId,
      );
    });
  });

  describe('resumeSubscription', () => {
    const userId = 'user-id';
    const subscriptionId = 'sub-id';

    it('should initiate subscription resume', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        cancelAt: new Date(),
      });

      await billingService.resumeSubscription(userId, subscriptionId);
      expect(mockStripe.resumeSubscription).toHaveBeenCalledWith(
        subscriptionId,
      );
    });

    it('should throw if subscription not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        billingService.resumeSubscription(userId, subscriptionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if subscription is already canceled', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.CANCELED,
      });

      await expect(
        billingService.resumeSubscription(userId, subscriptionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if subscription is not scheduled for cancellation', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        cancelAt: null,
      });

      await expect(
        billingService.resumeSubscription(userId, subscriptionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if stripe failed to resume subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        cancelAt: new Date(),
      });
      mockStripe.resumeSubscription.mockRejectedValue(new Error());

      await expect(
        billingService.resumeSubscription(userId, subscriptionId),
      ).rejects.toThrow(BadRequestException);
      expect(mockStripe.resumeSubscription).toHaveBeenCalledWith(
        subscriptionId,
      );
    });
  });

  describe('getPortalUrl', () => {
    const userId = 'user-id';
    const url = 'portal-url';

    it('should return portal url', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeCustomerId: 'customer-id',
      });
      mockStripe.createPortalSession.mockResolvedValue({ url });

      const result = await billingService.getPortalUrl(userId);
      expect(result).toEqual({ url });
    });

    it('should throw if customer not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(billingService.getPortalUrl(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ensureCustomer', () => {
    const user = {
      id: 'user-id',
      email: 'user-email',
      name: 'user-name',
      stripeCustomerId: 'customer-id',
    };

    const userWithoutCustomerId = {
      ...user,
      stripeCustomerId: null,
    };

    it('should return customer id if found', async () => {
      await expect(billingService['ensureCustomer'](user)).resolves.toEqual(
        user.stripeCustomerId,
      );
    });

    it('should call stripe to create customer', async () => {
      mockStripe.createCustomer.mockResolvedValue({
        id: user.stripeCustomerId,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await expect(
        billingService['ensureCustomer'](userWithoutCustomerId),
      ).resolves.toEqual(user.stripeCustomerId);

      expect(mockStripe.createCustomer).toHaveBeenCalledWith(
        user.email,
        user.name,
        user.id,
      );
    });

    it('should update user with customer id', async () => {
      mockStripe.createCustomer.mockResolvedValue({
        id: user.stripeCustomerId,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await expect(
        billingService['ensureCustomer'](userWithoutCustomerId),
      ).resolves.toEqual(user.stripeCustomerId);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { stripeCustomerId: user.stripeCustomerId },
      });
    });
  });
});
