import { Inject, Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';
import { REDIS, REDIS_KEY } from './redis.constants';
import { MS_PER_SECOND } from '../common/constants/time.constants';

interface Record {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<Record> {
    const k = `${REDIS_KEY.throttle}:${throttlerName}:${key}`;
    try {
      const hits = await this.redis.incr(k);
      if (hits === 1) await this.redis.pexpire(k, ttl);
      let pttl = await this.redis.pttl(k);
      if (pttl < 0) {
        await this.redis.pexpire(k, ttl);
        pttl = ttl;
      }
      const blocked = hits > limit;
      return {
        totalHits: hits,
        timeToExpire: Math.ceil(pttl / MS_PER_SECOND),
        isBlocked: blocked,
        timeToBlockExpire: blocked ? Math.ceil(pttl / MS_PER_SECOND) : 0,
      };
    } catch (e) {
      this.logger.warn(`throttler storage unavailable: ${(e as Error).message}`);
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
