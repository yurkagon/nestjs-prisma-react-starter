import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '@/app.module';
import type { Environment } from '@/config/env.schema';
import { API_PREFIX } from '@/config/openapi';
import { useClientApp } from '@/bootstrap/client-app';
import { useSwagger } from '@/bootstrap/swagger';
import { ExceptionsFilter } from '@/common/filters/exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Environment>);
  const port = config.getOrThrow('PORT', { infer: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ExceptionsFilter());

  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }) ?? [
      `http://localhost:${port}`,
      `http://localhost:${config.getOrThrow('CLIENT_PORT', { infer: true })}`,
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  app.setGlobalPrefix(API_PREFIX);

  useSwagger(app);

  useClientApp(app, config.get('CLIENT_DIST_PATH', { infer: true }));

  await app.listen(port);

  new Logger('Bootstrap').log(`Listening on http://localhost:${port}`);
}
void bootstrap();
