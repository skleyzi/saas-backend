import { fastifyAdapterConfig } from '@common/configs/fastify.config';
import fastifyCookie from '@fastify/cookie';
import { fastifyHelmet } from '@fastify/helmet';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter(fastifyAdapterConfig);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    { bufferLogs: true, rawBody: true },
  );

  const pinoInstance = fastifyAdapter.getInstance().log;
  app.useLogger({
    log: (msg) => pinoInstance.info(msg),
    error: (msg, stack) => pinoInstance.error({ stack }, msg),
    warn: (msg) => pinoInstance.warn(msg),
    debug: (msg) => pinoInstance.debug(msg),
    verbose: (msg) => pinoInstance.trace(msg),
  });

  await app.register(fastifyHelmet);

  app.enableCors({
    origin: app.get(ConfigService).getOrThrow('FRONTEND_URL'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  await app.register(fastifyCookie);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Saas Backend Template')
    .setVersion('0.0.1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        in: 'header',
      },
      'accessToken',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
