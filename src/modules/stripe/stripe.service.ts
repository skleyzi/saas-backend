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
    return await this.stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    userId: string,
  ) {
    return await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ['card'],
      success_url:
        this.configService.getOrThrow('SUCCESS_URL') +
        '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: this.configService.getOrThrow('CANCEL_URL'),
      metadata: { userId },
    });
  }

  async retrieveSubscriptions(subscriptionId: string) {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }
}
