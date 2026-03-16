import { SubscriptionStatus } from '@db/enums';
import Stripe from 'stripe';

export class BillingMapper {
  private static readonly STATUS_MAP: Record<
    Stripe.Subscription.Status,
    SubscriptionStatus
  > = {
    trialing: SubscriptionStatus.TRIALING,
    active: SubscriptionStatus.ACTIVE,
    canceled: SubscriptionStatus.CANCELED,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    past_due: SubscriptionStatus.PAST_DUE,
    unpaid: SubscriptionStatus.UNPAID,
    paused: SubscriptionStatus.PAUSED,
  };

  static toInternalStatus(
    stripeStatus: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    return this.STATUS_MAP[stripeStatus] || SubscriptionStatus.INCOMPLETE;
  }
}
