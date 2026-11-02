import { createHash } from 'crypto';
import { RateLimitedError } from '../../errors/auth-errors';
import { makeConfig } from '../../../test/test-helpers';
import { REDIS_KEY } from '../../../redis/redis.constants';
import { FailedSigninLimiter } from './failed-signin-limiter';

describe('FailedSigninLimiter', () => {
  const make = () => {
    const store = {
      read: jest.fn(async () => ({ failureCount: 0, secondsUntilReset: 0 })),
      increment: jest.fn(async () => undefined),
      remove: jest.fn(async () => undefined),
    };
    const cfg = makeConfig({ signin: { ...makeConfig().signin, maxPerIp: 5, maxPerEmail: 10, windowSeconds: 900 } });
    const limiter = new FailedSigninLimiter(store as never, cfg);
    return { limiter, store, cfg };
  };

  it('assertAllowed passes when counts are under limits', async () => {
    const { limiter } = make();
    await expect(limiter.assertAllowed('1.1.1.1', 'rowan@example.com')).resolves.toBeUndefined();
  });

  it('assertAllowed throws 429 with max retry-after when one rule exceeded', async () => {
    const { limiter, store } = make();
    store.read
      .mockResolvedValueOnce({ failureCount: 5, secondsUntilReset: 50 })
      .mockResolvedValueOnce({ failureCount: 0, secondsUntilReset: 0 });

    await expect(limiter.assertAllowed('1.1.1.1', 'rowan@example.com')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: 50,
    });
  });

  it('recordFailure increments both ip and email counters', async () => {
    const { limiter, store } = make();
    await limiter.recordFailure('1.1.1.1', 'rowan@example.com');

    expect(store.increment).toHaveBeenCalledTimes(2);
  const calls = store.increment.mock.calls as unknown as Array<[string]>;
  expect(calls[0][0]).toContain(`${REDIS_KEY.signinFailIp}:1.1.1.1`);
  });

  it('reset removes both ip and email counters', async () => {
    const { limiter, store } = make();
    await limiter.reset('1.1.1.1', 'rowan@example.com');

    expect(store.remove).toHaveBeenCalledTimes(2);
  });

  it('email key uses trimmed+lowercased sha256 hash', async () => {
    const { limiter, store } = make();
    await limiter.recordFailure('1.1.1.1', '  Rowan@Example.COM  ');

    const emailHash = createHash('sha256').update('rowan@example.com').digest('hex');
  const keys = (store.increment.mock.calls as unknown as Array<[string]>).map((c) => c[0]);
    expect(keys.some((k) => k === `${REDIS_KEY.signinFailEmail}:${emailHash}`)).toBe(true);
  });
});
