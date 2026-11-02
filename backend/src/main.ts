import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { APP_CONFIG, AppConfig } from './config/app-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get<AppConfig>(APP_CONFIG);

  app.getHttpAdapter().getInstance().set('trust proxy', cfg.trustProxyHops);
  app.use(requestIdMiddleware);
  app.use(helmet({ hsts: { maxAge: cfg.hsts.maxAgeSeconds, includeSubDomains: true } }));
  app.use(cookieParser());
  app.enableCors({ origin: cfg.frontendOrigin, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.listen(cfg.port);
}
bootstrap();
