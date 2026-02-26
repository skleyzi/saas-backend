import { fastifyAdapterConfig } from '@common/configs/pino.config';
import { AuthGuard } from '@common/guards/auth.guard';
import fastifyCookie from '@fastify/cookie';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter(fastifyAdapterConfig);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    { bufferLogs: true },
  );

  const pinoInstance = fastifyAdapter.getInstance().log;
  app.useLogger({
    log: (msg) => pinoInstance.info(msg),
    error: (msg, stack) => pinoInstance.error({ stack }, msg),
    warn: (msg) => pinoInstance.warn(msg),
    debug: (msg) => pinoInstance.debug(msg),
    verbose: (msg) => pinoInstance.trace(msg),
  });

  await app.register(fastifyCookie);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    }),
  );

  app.useGlobalGuards(new AuthGuard(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
