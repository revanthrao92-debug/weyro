import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  // Security headers with helmet
  app.use(helmet());

  // Strict CORS allowlist from env
  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow mobile apps, curl, or requests without Origin header
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const express = await import('express');
  const path = await import('path');
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const fs = await import('fs');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use(
    express.json({
      limit: '15mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ limit: '15mb', extended: true }));
  app.use('/uploads', express.static(uploadsDir));

  const port = env.PORT;
  await app.listen(port);
  console.log(`🚀 Weyro API server running on: http://localhost:${port}/api/v1`);
}

bootstrap();
