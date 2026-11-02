import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('EasyGenerator Backend API')
    .setDescription('Authentication and user endpoints for EasyGenerator backend')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token in Authorization header: Bearer <token>',
      },
      'bearer',
    )
    .addCookieAuth(cfg.cookie.name, {
      type: 'apiKey',
      in: 'cookie',
      name: cfg.cookie.name,
      description: 'Refresh token cookie',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(cfg.port);
}
bootstrap();
