import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(configService.getOrThrow('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-02-25.clover',
    });
  }

  async createCustomer(email: string, name: string, userId: string) {
    return await this.stripe.customers.create(
      {
        email,
        name,
        metadata: { userId },
      },
      { idempotencyKey: `create-customer-${userId}` },
    );
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    userId: string,
  ) {
    const timeGrain = new Date().toISOString().slice(0, 16);
    const idempotencyKey = `checkout-${userId}-${priceId}-${timeGrain}`;

    return await this.stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        payment_method_types: ['card'],
        success_url:
          this.configService.getOrThrow('SUCCESS_URL') +
          '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: this.configService.getOrThrow('CANCEL_URL'),
        subscription_data: {
          metadata: { userId },
        },
        metadata: { userId },
      },
      { idempotencyKey },
    );
  }

  async retrieveCustomer(customerId: string) {
    return await this.stripe.customers.retrieve(customerId);
  }

  async retrieveProduct(productId: string) {
    return await this.stripe.products.retrieve(productId);
  }

  async retrieveSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async retrievePrice(priceId: string) {
    return await this.stripe.prices.retrieve(priceId);
  }

  constructWebhookEvent(payload: Buffer, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async cancelSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at: 'min_period_end',
    });
  }

  async resumeSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at: null,
    });
  }

  async cancelSubscriptionImmediately(subscriptionId: string) {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    return await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async hasActiveSubscription(customerId: string) {
    const result = await this.stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });
    return result.data.length > 0;
  }
}
