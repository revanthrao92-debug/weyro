import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env.config';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // Security headers with helmet
  app.use(helmet());

  // Attach structured Request ID logging middleware
  app.use(new RequestIdMiddleware().use);

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
  console.log(`🚀 Weyro API server running on: http://localhost:${port}/api/v1`);
  if (env.NODE_ENV !== 'production') {
    console.log(
      `📚 OpenAPI Documentation available at: http://localhost:${port}/api/docs`,
    );
  }
}

bootstrap();
