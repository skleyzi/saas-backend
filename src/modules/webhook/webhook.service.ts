import { BillingInterval } from '@db/enums';
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
