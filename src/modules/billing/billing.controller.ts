import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { PlanResponseDto } from '@modules/billing/dto/plan-response.dto';
import { SubscriptionResponseDto } from '@modules/billing/dto/subscription-response.dto';
import { Controller, Get, Param, Post } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('plans')
  async listPlans() {
    const plans = await this.billingService.listPlans();
    return plans.map((p) => new PlanResponseDto(p));
  }

  @Get('subscription')
  async getCurrentSubscription(@CurrentUser('sub') userId: string) {
    const subscription =
      await this.billingService.getCurrentSubscription(userId);
    return new SubscriptionResponseDto(subscription);
  }

  @Post('subscription/:id/cancel')
  async cancelSubscription(
    @Param('id') subId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const subscription = await this.billingService.cancelSubscription(
      userId,
      subId,
    );

    return {
      message: 'Subscription will cancel at period end',
      subscription: new SubscriptionResponseDto(subscription),
    };
  }

  @Post('subscription/:id/resume')
  async resumeSubscription(
    @Param('id') subId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const subscription = await this.billingService.resumeSubscription(
      userId,
      subId,
    );

    return {
      message: 'Resumed subscription',
      subscription: new SubscriptionResponseDto(subscription),
    };
  }

  @Post('checkout/:planId')
  async createCheckoutSession(
    @CurrentUser('sub') userId: string,
    @Param('planId') planId: string,
  ) {
    return await this.billingService.createCheckoutSession(userId, planId);
  }
}
