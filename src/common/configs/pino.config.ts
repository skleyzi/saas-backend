import pino from 'pino';

export const pinoConfig: pino.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        }
      : undefined,
  redact: {
    paths: [
      '*.authorization',
      '*.cookie',
      '*.password',
      '*.confirmPassword',
      '*.email',
      '*.["set-cookie"]',
    ],
    censor: '***',
  },
};

export const fastifyAdapterConfig = {
  logger: pinoConfig,
  genReqId: () => crypto.randomUUID(),
};
