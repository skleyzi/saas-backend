import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { UsersModule } from '@modules/users/users.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { BillingModule } from './modules/billing/billing.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN_SECONDS: Joi.number().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_REFRESH_EXPIRES_IN_SECONDS: Joi.number().required(),
        STRIPE_SECRET_KEY: Joi.string().required(),
        SUCCESS_URL: Joi.string().uri().required(),
        CANCEL_URL: Joi.string().uri().required(),
      }),
    }),
    UsersModule,
    AuthModule,
    PrismaModule,
    StripeModule,
    BillingModule,
    WebhookModule,
  ],
})
export class AppModule {}
