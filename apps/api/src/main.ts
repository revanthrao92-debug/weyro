import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { AppModule } from './app.module';
import { env } from './config/env.config';
import { PinoLogger } from './common/logger/pino.logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // Behind a load balancer Express only sees the proxy socket. Without this,
  // the per-IP throttler would bucket every user under one address.
  if (env.TRUST_PROXY) {
    const trustProxy = env.TRUST_PROXY.trim();
    app.set(
      'trust proxy',
      trustProxy === 'true'
        ? true
        : /^\d+$/.test(trustProxy)
          ? Number(trustProxy)
          : trustProxy,
    );
  }

  // Security headers with helmet
  app.use(helmet());

  // Structured HTTP request logging with pino (includes request ID correlation)
  app.use(
    pinoHttp({
      logger: new PinoLogger('http').logger,
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
      base: {
        service: 'weyro-api',
        env: process.env.NODE_ENV || 'development',
      },
      // Custom request ID header
      genReqId: (req) => {
        return (
          req.headers['x-request-id'] ||
          `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        );
      },
      customLogLevel: (res: any, err: any) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req: any, res: any) =>
        `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req: any, res: any, err: any) =>
        `${req.method} ${req.url} ${res.statusCode} - ${err?.message}`,
    }),
  );

  // Use PinoLogger as the application logger
  app.useLogger(app.get(PinoLogger));

  // Strict CORS allowlist from env
  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Request body limits (rawBody is captured by Nest for webhook signatures)
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // Swagger / OpenAPI documentation (disabled in production)
  if (env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Weyro Marketplace API')
      .setDescription(
        'Automotive repair marketplace connecting vehicle owners with workshops and spare parts dealers across India.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = env.PORT;
  await app.listen(port);
  app.get(PinoLogger).log(`Weyro API server running on port ${port}`);
  if (env.NODE_ENV !== 'production') {
    app.get(PinoLogger).log(
      `OpenAPI Documentation available at: http://localhost:${port}/api/docs`,
    );
  }
}

bootstrap();
