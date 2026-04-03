import { fastifyAdapterConfig } from '@common/configs/fastify.config';
import fastifyCookie from '@fastify/cookie';
import { StripeService } from '@modules/stripe/stripe.service';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';

export async function createApp(): Promise<NestFastifyApplication> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(StripeService)
    .useValue({
      ...StripeService,
      constructWebhookEvent: (payload: Buffer) =>
        JSON.parse(payload.toString()),
    })
    .overrideProvider(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = module.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(fastifyAdapterConfig),
    { rawBody: true },
  );

  await app.register(fastifyCookie);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    }),
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
