import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { UsersModule } from '@modules/users/users.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeModule } from './modules/stripe/stripe.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    AuthModule,
    PrismaModule,
    StripeModule,
  ],
})
export class AppModule {}
