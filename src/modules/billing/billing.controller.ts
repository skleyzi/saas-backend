import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { SuccessResponseDto } from '@common/dto/success-response.dto';
import { PlanResponseDto } from '@modules/billing/dto/plan-response.dto';
import { SubscriptionResponseDto } from '@modules/billing/dto/subscription-response.dto';
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';

@Controller('billing')
@ApiBearerAuth('accessToken')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('plans')
  async listPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.billingService.listPlans();
    return plans.map((p) => new PlanResponseDto(p));
  }

  @Get('subscription')
  async getCurrentSubscription(
    @CurrentUser('id') userId: string,
  ): Promise<SubscriptionResponseDto> {
    const subscription =
      await this.billingService.getCurrentSubscription(userId);
    return new SubscriptionResponseDto(subscription);
  }

  @Post('subscription/:id/cancel')
  @HttpCode(200)
  async cancelSubscription(
    @Param('id') subId: string,
    @CurrentUser('id') userId: string,
  ): Promise<SuccessResponseDto> {
    await this.billingService.cancelSubscription(userId, subId);
    return new SuccessResponseDto(
      'Cancellation request received. It may take a few moments.',
    );
  }

  @Post('subscription/:id/resume')
  @HttpCode(200)
  async resumeSubscription(
    @Param('id') subId: string,
    @CurrentUser('id') userId: string,
  ): Promise<SuccessResponseDto> {
    await this.billingService.resumeSubscription(userId, subId);
    return new SuccessResponseDto(
      'Resume request received. It may take a few moments.',
    );
  }

  @Post('checkout/:planId')
  @HttpCode(200)
  async createCheckoutSession(
    @CurrentUser('id') userId: string,
    @Param('planId') planId: string,
  ): Promise<{ url: string | null }> {
    return await this.billingService.createCheckoutSession(userId, planId);
  }

  @Post('portal')
  @HttpCode(200)
  async getPortalUrl(
    @CurrentUser('id') userId: string,
  ): Promise<{ url: string }> {
    return await this.billingService.getPortalUrl(userId);
  }
}
