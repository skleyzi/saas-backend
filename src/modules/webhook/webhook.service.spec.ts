import { createMockPrismaService } from '@common/test/mock-prisma.service';
import { createMockStripeService } from '@common/test/mock-stripe.service';
import { BillingInterval, SubscriptionStatus } from '@db/enums';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StripeService } from '@modules/stripe/stripe.service';
import { WebhookService } from '@modules/webhook/webhook.service';
import { Test } from '@nestjs/testing';
import Stripe from 'stripe';

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockStripe: ReturnType<typeof createMockStripeService>;

  const price = {
    id: 'price-id',
    product: 'prod-id',
    unit_amount: 1000,
    currency: 'usd',
    active: true,
    type: 'recurring',
    recurring: {
      interval: 'month',
      interval_count: 1,
    },
  } as Stripe.Price;

  const plan = {
    id: 'prod-id',
    name: 'Test',
    active: true,
    metadata: { maxResources: 3 },
  } as unknown as Stripe.Product;

  const customer = {
    id: 'cus-id',
    email: 'email',
    name: 'name',
  } as Stripe.Customer;

  const subscription = {
    id: 'sub-id',
    status: 'active',
    items: {
      data: [
        {
          price: { id: 'price-id' },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        },
      ],
    },
    metadata: { userId: 'userId' },
  } as unknown as Stripe.Subscription;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockStripe = createMockStripeService();

    const module = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StripeService, useValue: mockStripe },
      ],
    }).compile();

    module.useLogger(false);

    webhookService = module.get<WebhookService>(WebhookService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleStripeEvent', () => {
    const event = {
      id: 'evt-id',
      type: 'product.updated',
      data: { object: { id: 'prod-id' } },
    } as Stripe.Event;

    it('should skip duplicate events', async () => {
      mockPrisma.webhookEvent.create.mockRejectedValue(
        new Error('Unique constraint'),
      );

      const result = await webhookService.handleStripeEvent(event);
      expect(result).toEqual({ skipped: true });
    });

    it('should mark event as successful after processing', async () => {
      mockPrisma.webhookEvent.create.mockResolvedValue({});
      mockPrisma.webhookEvent.update.mockResolvedValue({});
      mockStripe.retrieveProduct.mockResolvedValue(plan);
      mockPrisma.plan.updateMany.mockResolvedValue({});

      await webhookService.handleStripeEvent(event);

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { stripeEventId: event.id },
        data: { isSuccessful: true },
      });
    });

    it('should mark event as failed and rethrow on handler error', async () => {
      mockPrisma.webhookEvent.create.mockResolvedValue({});
      mockPrisma.webhookEvent.update.mockResolvedValue({});
      mockStripe.retrieveProduct.mockRejectedValue(new Error('Stripe down'));

      await expect(webhookService.handleStripeEvent(event)).rejects.toThrow(
        'Stripe down',
      );

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { stripeEventId: event.id },
        data: { isSuccessful: false },
      });
    });
  });

  describe('upsertPrice', () => {
    it('should upsert plan', async () => {
      mockStripe.retrieveProduct.mockResolvedValue(plan);

      mockPrisma.plan.upsert.mockResolvedValue({});

      await webhookService['upsertPrice'](price);

      const planData = {
        name: plan.name,
        currency: price.currency,
        interval: BillingInterval.MONTH,
        maxResources: 3,
        intervalCount: 1,
        isActive: true,
      };

      expect(mockPrisma.plan.upsert).toHaveBeenCalledWith({
        where: { stripePriceId: price.id },
        update: {
          ...planData,
          priceInCents: price.unit_amount,
        },
        create: {
          ...planData,
          priceInCents: price.unit_amount ?? 0,
          stripeProductId: plan.id,
          stripePriceId: price.id,
        },
      });
    });

    it('should not upsert plan if price has no unit amount', async () => {
      const invalidPrice = {
        ...price,
        unit_amount: null,
      } as Stripe.Price;

      await webhookService['upsertPrice'](invalidPrice);

      expect(mockPrisma.plan.upsert).not.toHaveBeenCalled();
    });

    it('should deactivate plan if price is unsupported', async () => {
      const unsupportedPrices = [
        {
          ...price,
          type: 'one_time',
          recurring: null,
        },
        {
          ...price,
          recurring: { usage_type: 'metered', interval: 'month' },
        },
        {
          ...price,
          billing_scheme: 'tiered',
        },
        {
          ...price,
          recurring: { interval: 'week', interval_count: 1 },
        },
      ];

      mockPrisma.plan.updateMany.mockResolvedValue({});

      for (const price of unsupportedPrices) {
        await webhookService['upsertPrice'](price as unknown as Stripe.Price);

        expect(mockPrisma.plan.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { stripePriceId: price.id },
            data: { isActive: false },
          }),
        );
        expect(mockPrisma.plan.upsert).not.toHaveBeenCalled();
      }
    });

    it('should not upsert plan if product not found', async () => {
      mockStripe.retrieveProduct.mockResolvedValue(null);

      await webhookService['upsertPrice'](price);

      expect(mockPrisma.plan.upsert).not.toHaveBeenCalled();
    });
  });

  describe('handlePriceDeleted', () => {
    it('should mark plan as inactive', async () => {
      mockPrisma.plan.updateMany.mockResolvedValue({});

      await webhookService['handlePriceDeleted'](price.id);

      expect(mockPrisma.plan.updateMany).toHaveBeenCalledWith({
        where: { stripePriceId: price.id },
        data: { isActive: false },
      });
    });
  });

  describe('handleProductUpdate', () => {
    it('should update all plans for product', async () => {
      mockPrisma.plan.updateMany.mockResolvedValue({});

      await webhookService['handleProductUpdate'](plan);

      expect(mockPrisma.plan.updateMany).toHaveBeenCalledWith({
        where: { stripeProductId: plan.id },
        data: {
          name: plan.name,
          isActive: plan.active,
          maxResources: plan.metadata?.maxResources
            ? Number(plan.metadata.maxResources)
            : undefined,
        },
      });
    });
  });

  describe('handleCustomerUpdated', () => {
    it('should update user for updated customer', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({});

      await webhookService['handleCustomerUpdated'](customer);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { stripeCustomerId: customer.id },
        data: {
          email: customer.email ?? undefined,
          name: customer.name ?? undefined,
        },
      });
    });

    it('should not update user for deleted customer', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({});

      await webhookService['handleCustomerUpdated']({
        ...customer,
        deleted: true,
      });

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('handleCustomerDeleted', () => {
    it('should clear stripeCustomerId on user for deleted customer', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({});

      await webhookService['handleCustomerDeleted'](customer);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { stripeCustomerId: customer.id },
        data: { stripeCustomerId: null },
      });
    });
  });

  describe('upsertSubscription', () => {
    it('should upsert subscription', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-id' });
      mockPrisma.plan.findUnique.mockResolvedValue({ id: plan.id });
      mockPrisma.subscription.upsert.mockResolvedValue({});

      const subscriptionData = {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(
          subscription.items.data[0].current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          subscription.items.data[0].current_period_end * 1000,
        ),
        cancelAt: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : null,
      };

      await webhookService['upsertSubscription'](subscription);

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: subscription.id },
        update: subscriptionData,
        create: {
          ...subscriptionData,
          userId: 'user-id',
          planId: plan.id,
          stripeSubscriptionId: subscription.id,
        },
      });
    });

    it('should find user by stripeCustomerId if no userId in metadata', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-id' });
      mockPrisma.plan.findUnique.mockResolvedValue({ id: plan.id });
      mockPrisma.subscription.upsert.mockResolvedValue({});

      await webhookService['upsertSubscription']({
        ...subscription,
        metadata: {},
        customer: customer.id,
      });

      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
    });

    it('should throw if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        webhookService['upsertSubscription'](subscription),
      ).rejects.toThrow();
    });

    it('should not upsert subscription if no item on subscription', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-id' });

      await webhookService['upsertSubscription']({
        ...subscription,
        items: { data: [] },
      } as unknown as Stripe.Subscription);

      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('should not upsert subscription if plan not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-id' });
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await webhookService['upsertSubscription'](subscription);

      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('should mark subscription as canceled', async () => {
      mockPrisma.subscription.updateMany.mockResolvedValue({});

      await webhookService['handleSubscriptionDeleted'](subscription.id);

      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: SubscriptionStatus.CANCELED },
      });
    });
  });

  describe('handleInvoiceEvent', () => {
    it('should retrieve and upsert subscription from invoice', async () => {
      const invoice = {
        id: 'invoice-id',
        parent: {
          type: 'subscription_details',
          subscription_details: { subscription: subscription.id },
        },
        billing_reason: 'subscription_cycle',
      } as unknown as Stripe.Invoice;

      mockStripe.retrieveSubscription.mockResolvedValue(subscription);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-id' });
      mockPrisma.plan.findUnique.mockResolvedValue(plan);
      mockPrisma.subscription.upsert.mockResolvedValue({});

      await webhookService['handleInvoiceEvent'](invoice);

      expect(mockStripe.retrieveSubscription).toHaveBeenCalledWith('sub-id');
    });

    it('should return early if invoice has no subscription parent', async () => {
      const invoice = {
        parent: { type: 'payment_intent_details' },
      } as unknown as Stripe.Invoice;

      await webhookService['handleInvoiceEvent'](invoice);

      expect(mockStripe.retrieveSubscription).not.toHaveBeenCalled();
    });
  });

  describe('handleSessionExpired', () => {
    it('should mark subscription as expired', async () => {
      const session = {
        subscription: 'sub-id',
      } as unknown as Stripe.Checkout.Session;
      mockPrisma.subscription.updateMany.mockResolvedValue({});

      await webhookService['handleSessionExpired'](session);

      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: session.subscription },
        data: { status: SubscriptionStatus.INCOMPLETE_EXPIRED },
      });
    });

    it('should not update if session has no subscription', async () => {
      const session = {
        subscription: null,
      } as unknown as Stripe.Checkout.Session;

      await webhookService['handleSessionExpired'](session);

      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
    });
  });
});
