import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { REDIS } from '../redis/redis.constants';
import { SessionsModule } from '../sessions/sessions.module';
import { TokensModule } from '../tokens/tokens.module';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { COUNTER_STORE, CounterStore, MemoryCounterStore } from '../common/helpers/auth/counter-store';
import { RedisCounterStore } from '../common/helpers/auth/redis-counter-store';
import { PasswordHasher } from '../common/helpers/auth/password-hasher';
import { FailedSigninLimiter } from '../common/helpers/auth/failed-signin-limiter';
import { RefreshRotation } from '../common/helpers/auth/refresh-rotation';

@Module({
  imports: [UsersModule, SessionsModule, TokensModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshRotation,
    PasswordHasher,
    FailedSigninLimiter,
    {
      provide: COUNTER_STORE,
      inject: [REDIS, APP_CONFIG],
      useFactory: (redis: Redis | null, cfg: AppConfig): CounterStore => {
        const memory = new MemoryCounterStore(cfg.signin.windowSeconds, cfg.signin.maxMemoryKeys);
        return redis ? new RedisCounterStore(redis, cfg.signin.windowSeconds, memory) : memory;
      },
    },
  ],
})
export class AuthModule {}
