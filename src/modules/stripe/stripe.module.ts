import { StripeService } from '@modules/stripe/stripe.service';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
