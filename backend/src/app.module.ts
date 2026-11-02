import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuthExceptionFilter } from './common/filters/auth-exception.filter';
import { OriginGuard } from './common/guards/origin.guard';
import { DatabaseModule } from './database/database.module';
import Redis from 'ioredis';
import { REDIS } from './redis/redis.constants';
import { RedisModule } from './redis/redis.module';
import { RedisThrottlerStorage } from './redis/redis-throttler.storage';
import { APP_CONFIG, AppConfig } from './config/app-config';
import { AppConfigModule } from './config/app-config.module';
import { SessionsModule } from './sessions/sessions.module';
import { TokensModule } from './tokens/tokens.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    MongooseModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({ uri: cfg.mongoUri }),
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [REDIS, APP_CONFIG],
      useFactory: (redis: Redis | null, cfg: AppConfig) => ({
        throttlers: [{ ttl: cfg.throttle.ttlMs, limit: cfg.throttle.limit }],
        // memory store: the throttler's built-in storage is used
        ...(redis ? { storage: new RedisThrottlerStorage(redis) } : {}),
      }),
    }),
    DatabaseModule,
    UsersModule,
    SessionsModule,
    TokensModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AuthExceptionFilter },
  ],
})
export class AppModule {}
