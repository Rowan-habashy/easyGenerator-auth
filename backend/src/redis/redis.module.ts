import { Global, Logger, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { REDIS } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): Redis | null => {
        if (cfg.rateLimitStore !== 'redis') return null;
        const logger = new Logger('Redis');
        const client = new Redis(cfg.redisUrl, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          lazyConnect: false,
        });
        client.on('error', (e) => logger.warn(`redis error: ${e.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  async onApplicationShutdown() {
    this.redis?.disconnect();
  }
}
