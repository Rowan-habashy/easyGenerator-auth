import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RateLimitedError } from '../../errors/auth-errors';
import { APP_CONFIG, AppConfig } from '../../../config/app-config';
import { REDIS_KEY } from '../../../redis/redis.constants';
import { COUNTER_STORE, CounterStore } from './counter-store';

interface FailureRule {
  key: string;
  maxFailures: number;
}

@Injectable()
export class FailedSigninLimiter {
  constructor(
    @Inject(COUNTER_STORE) private readonly store: CounterStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async assertAllowed(ipAddress: string, email: string): Promise<void> {
    const rules = this.buildRules(ipAddress, email);
    const readings = await Promise.all(rules.map((rule) => this.store.read(rule.key)));

    let retryAfterSeconds = 0;
    readings.forEach((reading, i) => {
      if (reading.failureCount < rules[i].maxFailures) return;
      const resetDelay = reading.secondsUntilReset > 0 ? reading.secondsUntilReset : this.config.signin.windowSeconds;
      retryAfterSeconds = Math.max(retryAfterSeconds, resetDelay);
    });

    if (retryAfterSeconds > 0) throw new RateLimitedError(retryAfterSeconds);
  }

  async recordFailure(ipAddress: string, email: string): Promise<void> {
    await Promise.all(this.buildRules(ipAddress, email).map((rule) => this.store.increment(rule.key)));
  }

  async reset(ipAddress: string, email: string): Promise<void> {
    await Promise.all(this.buildRules(ipAddress, email).map((rule) => this.store.remove(rule.key)));
  }

  private buildRules(ipAddress: string, email: string): FailureRule[] {
    const emailHash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    return [
      { key: `${REDIS_KEY.signinFailIp}:${ipAddress}`, maxFailures: this.config.signin.maxPerIp },
      { key: `${REDIS_KEY.signinFailEmail}:${emailHash}`, maxFailures: this.config.signin.maxPerEmail },
    ];
  }
}
