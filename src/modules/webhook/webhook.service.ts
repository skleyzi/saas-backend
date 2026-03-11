import { BillingInterval, SubscriptionStatus } from '@db/enums';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StripeService } from '@modules/stripe/stripe.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async handleStripeEvent(event: Stripe.Event) {
    this.logger.log({
      msg: 'Processing event',
      type: event.type,
      stripeEventId: event.id,
    });

    switch (event.type) {
      case 'price.updated':
      case 'price.created':
        await this.upsertPrice(event.data.object as Stripe.Price);
        break;
      case 'price.deleted':
        await this.handlePriceDeleted(event.data.object as Stripe.Price);
        break;
      case 'product.updated':
        await this.handleProductUpdate(event.data.object as Stripe.Product);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      default:
        break;
    }
  }

  private async upsertPrice(price: Stripe.Price) {
    if (!price.unit_amount) {
      this.logger.error({
        msg: 'Plan must specify a unit amount',
        priceId: price.id,
      });
      return;
    }

    const validation = this.isSupportedPrice(price);

    if (!validation.supported) {
      await this.prisma.plan.updateMany({
        where: { stripePriceId: price.id },
        data: { isActive: false },
      });

      this.logger.warn({
        msg: 'Plan deactivated',
        priceId: price.id,
        reason: validation.reason,
      });
      return;
    }

    if (!price.recurring) return;

    const productId =
      typeof price.product === 'string' ? price.product : price.product.id;
    if (!productId) return;

    const product = await this.stripeService.retrieveProduct(productId);
    if (!product) return;

    const maxResources = product.metadata?.maxResources
      ? Number(product.metadata.maxResources)
      : null;

    const planData = {
      name: product.name,
      currency: price.currency,
      interval: this.INTERVAL_MAP[price.recurring.interval],
      maxResources: maxResources ?? undefined,
      intervalCount: price.recurring.interval_count ?? undefined,
      isActive: price.active && product.active,
    };

    await this.prisma.plan.upsert({
      where: { stripePriceId: price.id },
      update: {
        ...planData,
        priceInCents: price.unit_amount,
      },
      create: {
        ...planData,
        priceInCents: price.unit_amount ?? 0,
        stripeProductId: product.id,
        stripePriceId: price.id,
      },
    });
  }

  private async handlePriceDeleted(price: Stripe.Price) {
    this.logger.log({
      msg: 'Marking Plan as inactive',
      stripePriceId: price.id,
    });

    await this.prisma.plan.updateMany({
      where: { stripePriceId: price.id },
      data: { isActive: false },
    });
  }

  private async handleProductUpdate(product: Stripe.Product) {
    this.logger.log({
      msg: 'Updating all plans for product',
      productId: product.id,
    });

    await this.prisma.plan.updateMany({
      where: { stripeProductId: product.id },
      data: {
        name: product.name,
        isActive: product.active,
        maxResources: product.metadata?.maxResources
          ? Number(product.metadata.maxResources)
          : undefined,
      },
    });
  }

  private async upsertSubscription(subscription: Stripe.Subscription) {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      this.logger.warn({
        msg: 'User not found',
        customerId,
        subscriptionId: subscription.id,
      });
      throw new NotFoundException(
        `User with customer ID ${customerId} not found`,
      );
    }

    const item = subscription.items.data[0];
    if (!item) return;

    const priceId = item.price.id;

    const plan = await this.prisma.plan.findUnique({
      where: { stripePriceId: priceId },
    });

    if (!plan) return;

    this.logger.log({
      msg: 'Upserting subscription',
      subscriptionId: subscription.id,
    });

    const subscriptionData = {
      status: this.STATUS_MAP[subscription.status],
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };

    await this.prisma.subscription.upsert({
      where: {
        stripeSubscriptionId: subscription.id,
      },
      update: subscriptionData,
      create: {
        ...subscriptionData,
        userId: user.id,
        planId: plan.id,
        stripeSubscriptionId: subscription.id,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'CANCELED' },
    });
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (!session.subscription) return;

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    const stripeSub =
      await this.stripeService.retrieveSubscription(subscriptionId);
    await this.upsertSubscription(stripeSub);
  }

  private isSupportedPrice(price: Stripe.Price): {
    supported: boolean;
    reason?: string;
  } {
    if (price.type !== 'recurring' || !price.recurring) {
      return {
        supported: false,
        reason: 'Only recurring prices are supported',
      };
    }

    if (price.recurring?.usage_type === 'metered') {
      return { supported: false, reason: 'Metered billing is not supported' };
    }

    if (price.billing_scheme === 'tiered') {
      return { supported: false, reason: 'Tiered billing is not supported' };
    }

    if (!this.INTERVAL_MAP[price.recurring?.interval]) {
      return {
        supported: false,
        reason: `Interval "${price.recurring?.interval}" is not supported`,
      };
    }

    return { supported: true };
  }

  private readonly INTERVAL_MAP: Record<string, BillingInterval> = {
    month: BillingInterval.MONTH,
    year: BillingInterval.YEAR,
  };

  private STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    trialing: SubscriptionStatus.TRIALING,
    active: SubscriptionStatus.ACTIVE,
    canceled: SubscriptionStatus.CANCELED,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    past_due: SubscriptionStatus.PAST_DUE,
    unpaid: SubscriptionStatus.UNPAID,
    paused: SubscriptionStatus.PAUSED,
  };
}
