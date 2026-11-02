import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { RateLimitedError } from '../common/errors/auth-errors';
import { MS_PER_SECOND } from '../common/constants/time.constants';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { REDIS, REDIS_KEY } from '../redis/redis.constants';

interface FailureCounterRule {
  redisKey: string;
  maxFailures: number;
}

interface CounterReading {
  failureCount: number;
  secondsUntilReset: number;
}

interface MemoryCounterEntry {
  failureCount: number;
  resetAtMs: number;
}

@Injectable()
export class FailedSigninLimiter {
  private readonly logger = new Logger(FailedSigninLimiter.name);
  private readonly memoryFallback = new Map<string, MemoryCounterEntry>();

  constructor(
    @Inject(REDIS) private readonly redis: Redis | null,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async assertAllowed(ipAddress: string, email: string): Promise<void> {
    let retryAfterSeconds = 0;

    for (const rule of this.buildRules(ipAddress, email)) {
      const reading = await this.readCounter(rule.redisKey);
      if (reading.failureCount >= rule.maxFailures) {
        const resetDelay = reading.secondsUntilReset > 0 ? reading.secondsUntilReset : this.config.signin.windowSeconds;
        retryAfterSeconds = Math.max(retryAfterSeconds, resetDelay);
      }
    }

    if (retryAfterSeconds > 0) throw new RateLimitedError(retryAfterSeconds);
  }

  async recordFailure(ipAddress: string, email: string): Promise<void> {
    for (const rule of this.buildRules(ipAddress, email)) {
      await this.incrementCounter(rule.redisKey);
    }
  }

  async reset(ipAddress: string, email: string): Promise<void> {
    for (const rule of this.buildRules(ipAddress, email)) {
      await this.removeCounter(rule.redisKey);
    }
  }


  private buildRules(ipAddress: string, email: string): FailureCounterRule[] {
    const emailHash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    return [
      { redisKey: `${REDIS_KEY.signinFailIp}:${ipAddress}`, maxFailures: this.config.signin.maxPerIp },
      { redisKey: `${REDIS_KEY.signinFailEmail}:${emailHash}`, maxFailures: this.config.signin.maxPerEmail },
    ];
  }

  private async readCounter(redisKey: string): Promise<CounterReading> {
    if (!this.redis) return this.readMemoryCounter(redisKey);
    try {
      const [rawCount, ttlSeconds] = await Promise.all([this.redis.get(redisKey), this.redis.ttl(redisKey)]);
      return { failureCount: Number(rawCount ?? 0), secondsUntilReset: ttlSeconds };
    } catch (error) {
      this.logRedisFailure('read', error);
      return this.readMemoryCounter(redisKey);
    }
  }

  private readMemoryCounter(redisKey: string): CounterReading {
    const entry = this.getLiveMemoryEntry(redisKey);
    if (!entry) return { failureCount: 0, secondsUntilReset: 0 };
    return {
      failureCount: entry.failureCount,
      secondsUntilReset: Math.ceil((entry.resetAtMs - Date.now()) / MS_PER_SECOND),
    };
  }

  private async incrementCounter(redisKey: string): Promise<void> {
    if (!this.redis) return this.incrementMemoryCounter(redisKey);
    try {
      const newCount = await this.redis.incr(redisKey);
      if (newCount === 1) await this.redis.expire(redisKey, this.config.signin.windowSeconds);
    } catch (error) {
      this.logRedisFailure('increment', error);
      this.incrementMemoryCounter(redisKey);
    }
  }

  private async removeCounter(redisKey: string): Promise<void> {
    this.memoryFallback.delete(redisKey);
    if (!this.redis) return;
    try {
      await this.redis.del(redisKey);
    } catch (error) {
      this.logRedisFailure('delete', error);
    }
  }


  private incrementMemoryCounter(redisKey: string): void {
    const entry = this.getLiveMemoryEntry(redisKey);
    if (entry) {
      entry.failureCount++;
      return;
    }
    if (this.memoryFallback.size >= this.config.signin.maxMemoryKeys) this.evictStaleMemoryEntries();
    const resetAtMs = Date.now() + this.config.signin.windowSeconds * MS_PER_SECOND;
    this.memoryFallback.set(redisKey, { failureCount: 1, resetAtMs });
  }

  private getLiveMemoryEntry(redisKey: string): MemoryCounterEntry | undefined {
    const entry = this.memoryFallback.get(redisKey);
    if (!entry) return undefined;
    if (entry.resetAtMs <= Date.now()) {
      this.memoryFallback.delete(redisKey);
      return undefined;
    }
    return entry;
  }

  private evictStaleMemoryEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryFallback) {
      if (entry.resetAtMs <= now) this.memoryFallback.delete(key);
    }
    if (this.memoryFallback.size >= this.config.signin.maxMemoryKeys) {
      const oldestKey = this.memoryFallback.keys().next().value;
      if (oldestKey) this.memoryFallback.delete(oldestKey);
    }
  }

  private logRedisFailure(operation: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`redis unavailable (${operation}), using in-memory fallback: ${message}`);
  }
}
