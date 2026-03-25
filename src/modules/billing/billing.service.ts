import { SubscriptionStatus } from '@db/enums';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StripeService } from '@modules/stripe/stripe.service';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createCheckoutSession(userId: string, planId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const hasActiveLocal = user.subscriptions.some(
      (s) =>
        s.status === SubscriptionStatus.ACTIVE ||
        s.status === SubscriptionStatus.TRIALING ||
        s.status === SubscriptionStatus.PAST_DUE,
    );

    if (hasActiveLocal)
      throw new BadRequestException(
        'User already has active or past due subscription',
      );

    if (
      user.stripeCustomerId &&
      (await this.stripeService.hasActiveSubscription(user.stripeCustomerId))
    ) {
      this.logger.warn({
        msg: 'Found ghost sub in Stripe, blocking checkout',
        userId,
      });
      throw new BadRequestException('You already have an active subscription.');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found or inactive');
    }

    const customerId = await this.ensureCustomer(user);

    const session = await this.stripeService.createCheckoutSession(
      customerId,
      plan.stripePriceId,
      user.id,
    );

    this.logger.log({
      msg: 'Checkout session created',
      userId,
      planId,
      sessionId: session.id,
    });

    return { url: session.url };
  }

  async getCurrentSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
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
    });

    if (!subscription)
      throw new NotFoundException('No active subscription found');

    return subscription;
  }

  async listPlans() {
    return await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceInCents: 'asc' },
    });
  }

  async cancelSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    if (subscription.status === SubscriptionStatus.CANCELED)
      throw new BadRequestException('Subscription is already canceled');

    if (subscription.cancelAt)
      throw new BadRequestException(
        'Subscription already scheduled for cancellation',
      );

    try {
      await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : error;
      this.logger.error(`Stripe failed to cancel subscription: ${message}`);

      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  async resumeSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    if (subscription.status === SubscriptionStatus.CANCELED) {
      throw new BadRequestException('Subscription is already canceled');
    }

    if (!subscription.cancelAt) {
      throw new BadRequestException(
        'Subscription is not scheduled for cancellation',
      );
    }

    try {
      await this.stripeService.resumeSubscription(
        subscription.stripeSubscriptionId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : error;
      this.logger.error(`Stripe failed to resume subscription: ${message}`);

      throw new BadRequestException('Failed to resume subscription');
    }
  }

  async getPortalUrl(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId)
      throw new NotFoundException(
        'Customer record not found. Please subscribe first.',
      );

    const { url } = await this.stripeService.createPortalSession(
      user.stripeCustomerId,
      this.configService.getOrThrow<string>('BILLING_SETTINGS_URL'),
    );

    return { url };
  }

  private async ensureCustomer(user: {
    id: string;
    email: string;
    name: string;
    stripeCustomerId: string | null;
  }) {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripeService.createCustomer(
      user.email,
      user.name,
      user.id,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }
}
