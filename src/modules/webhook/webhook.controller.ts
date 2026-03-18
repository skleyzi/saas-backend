import { Public } from '@common/decorators/public.decorator';
import { StripeService } from '@modules/stripe/stripe.service';
import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { WebhookService } from './webhook.service';

@Public()
@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('stripe-signature') sig: string,
  ): Promise<{ received: boolean }> {
    if (!sig || !req.rawBody)
      throw new BadRequestException('Missing stripe header or body');

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(
        req.rawBody,
        sig,
        this.configService.getOrThrow('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.webhookService.handleStripeEvent(event);
    return { received: true };
  }
}
