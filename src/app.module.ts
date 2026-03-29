import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { AuthGuard } from '@common/guards/auth.guard';
import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { UsersModule } from '@modules/users/users.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Joi from 'joi';
import { AdminModule } from './modules/admin/admin.module';
import { BillingModule } from './modules/billing/billing.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: minutes(1),
          limit: 60,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN_SECONDS: Joi.number().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_REFRESH_EXPIRES_IN_SECONDS: Joi.number().required(),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        SUCCESS_URL: Joi.string().uri().required(),
        CANCEL_URL: Joi.string().uri().required(),
        BILLING_SETTINGS_URL: Joi.string().uri().required(),
        FRONTEND_URL: Joi.string().uri().required(),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
      }),
      validationOptions: {
        abortEarly: true,
      },
    }),
    UsersModule,
    AuthModule,
    PrismaModule,
    StripeModule,
    BillingModule,
    WebhookModule,
    ResourcesModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
