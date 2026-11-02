import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CounterReading, CounterStore } from './counter-store';

export class RedisCounterStore implements CounterStore {
  private readonly logger = new Logger(RedisCounterStore.name);

  constructor(
    private readonly redis: Redis,
    private readonly windowSeconds: number,
    private readonly fallback: CounterStore,
  ) {}

  async read(key: string): Promise<CounterReading> {
    try {
      const [rawCount, ttlSeconds] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
      return { failureCount: Number(rawCount ?? 0), secondsUntilReset: ttlSeconds };
    } catch (error) {
      this.logFailure('read', error);
      return this.fallback.read(key);
    }
  }

  async increment(key: string): Promise<void> {
    try {
      const newCount = await this.redis.incr(key);
      if (newCount === 1) await this.redis.expire(key, this.windowSeconds);
    } catch (error) {
      this.logFailure('increment', error);
      await this.fallback.increment(key);
    }
  }

  async remove(key: string): Promise<void> {
    await this.fallback.remove(key);
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logFailure('delete', error);
    }
  }

  private logFailure(operation: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`redis unavailable (${operation}), using in-memory fallback: ${message}`);
  }
}
