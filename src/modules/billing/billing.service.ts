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

    const existingActive = user.subscriptions.find(
      (s) =>
        s.status === SubscriptionStatus.ACTIVE ||
        s.status === SubscriptionStatus.TRIALING ||
        s.status === SubscriptionStatus.PAST_DUE,
    );

    if (existingActive)
      throw new BadRequestException(
        'User already has active or past due subscription',
      );

    const customerId = await this.upsertCustomer(user);

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
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');
    if (subscription.status === SubscriptionStatus.CANCELED)
      throw new BadRequestException('Subscription already canceled');
    if (subscription.cancelAtPeriodEnd)
      throw new BadRequestException(
        'Subscription already marked for cancellation',
      );

    await this.stripeService.cancelSubscriptionAtPeriodEnd(
      subscription.stripeSubscriptionId,
    );
  }

  async resumeSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    if (!subscription.cancelAtPeriodEnd) {
      throw new BadRequestException(
        'Subscription is not scheduled for cancellation',
      );
    }

    const resumableStatuses: Partial<SubscriptionStatus>[] = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
    ];
    if (!resumableStatuses.includes(subscription.status)) {
      throw new BadRequestException(
        `Cannot resume a subscription with status: ${subscription.status}`,
      );
    }

    await this.stripeService.resumeSubscription(
      subscription.stripeSubscriptionId,
    );
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

  private async upsertCustomer(user: {
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
