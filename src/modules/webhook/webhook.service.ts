import { BillingInterval, SubscriptionStatus } from '@db/enums';
import { BillingMapper } from '@modules/billing/billing.mapper';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StripeService } from '@modules/stripe/stripe.service';
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async handleStripeEvent(event: Stripe.Event) {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
        },
      });
    } catch {
      return { skipped: true };
    }

    try {
      const object = event.data.object as { id: string };
      switch (event.type) {
        case 'price.updated':
        case 'price.created': {
          const price = await this.stripeService.retrievePrice(object.id);
          await this.upsertPrice(price);
          break;
        }
        case 'price.deleted': {
          await this.handlePriceDeleted(object.id);
          break;
        }
        case 'product.updated': {
          const product = await this.stripeService.retrieveProduct(object.id);
          await this.handleProductUpdate(product);
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.paused':
        case 'customer.subscription.resumed': {
          const sub = await this.stripeService.retrieveSubscription(object.id);
          await this.upsertSubscription(sub);
          break;
        }
        case 'customer.subscription.deleted': {
          await this.handleSubscriptionDeleted(object.id);
          break;
        }
        case 'invoice.paid':
        case 'invoice.payment_failed': {
          await this.handleInvoiceEvent(event.data.object as Stripe.Invoice);
          break;
        }
        case 'checkout.session.expired': {
          await this.handleSessionExpired(
            event.data.object as Stripe.Checkout.Session,
          );
          break;
        }
        default:
          break;
      }

      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { isSuccessful: true },
      });
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { isSuccessful: false },
      });
      throw error;
    }
  }

  private async handleSessionExpired(session: Stripe.Checkout.Session) {
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) return;

    this.logger.log({
      msg: 'Checkout session expired, updating status',
      subscriptionId,
    });

    await this.prisma.subscription.updateMany({
      where: {
        stripeSubscriptionId: subscriptionId,
      },
      data: {
        status: SubscriptionStatus.INCOMPLETE_EXPIRED,
      },
    });
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

  private async handlePriceDeleted(stripePriceId: string) {
    this.logger.log({
      msg: 'Marking Plan as inactive',
      stripePriceId,
    });

    await this.prisma.plan.updateMany({
      where: { stripePriceId },
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
    const userId = subscription.metadata?.userId;

    let user;
    if (userId) {
      user = await this.prisma.user.findUnique({ where: { id: userId } });
    } else {
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      user = await this.prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
      });
    }

    if (!user) {
      this.logger.warn({
        msg: 'User not found',
        subscriptionId: subscription.id,
      });
      throw new Error(`User not found for subscription ${subscription.id}`);
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
      status: BillingMapper.toInternalStatus(subscription.status),
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

  private async handleSubscriptionDeleted(stripeSubscriptionId: string) {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: { status: SubscriptionStatus.CANCELED },
    });
  }

  private async handleInvoiceEvent(invoice: Stripe.Invoice) {
    const subscriptionId =
      invoice.parent?.type === 'subscription_details'
        ? typeof invoice.parent.subscription_details?.subscription === 'string'
          ? invoice.parent.subscription_details.subscription
          : invoice.parent.subscription_details?.subscription.id
        : null;

    if (!subscriptionId) return;

    this.logger.log({
      msg: 'Processing invoice event',
      invoiceId: invoice.id,
      subscriptionId,
      type: invoice.billing_reason,
    });

    const subscription =
      await this.stripeService.retrieveSubscription(subscriptionId);

    await this.upsertSubscription(subscription);
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
}
