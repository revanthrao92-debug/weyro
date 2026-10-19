import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: '*',
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

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));
  app.use('/uploads', express.static(uploadsDir));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Weyro API server running on: http://localhost:${port}/api/v1`);
}

bootstrap();
