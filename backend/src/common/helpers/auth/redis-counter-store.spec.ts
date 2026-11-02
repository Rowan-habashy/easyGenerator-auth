import { CounterStore } from './counter-store';
import { RedisCounterStore } from './redis-counter-store';

describe('RedisCounterStore', () => {
  const make = () => {
    const fallback: CounterStore = {
      read: jest.fn(async () => ({ failureCount: 7, secondsUntilReset: 11 })),
      increment: jest.fn(async () => undefined),
      remove: jest.fn(async () => undefined),
    };
    const redis = {
      get: jest.fn(async () => '3'),
      ttl: jest.fn(async () => 9),
      incr: jest.fn(async () => 1),
      expire: jest.fn(async () => 1),
      del: jest.fn(async () => 1),
    };
    const store = new RedisCounterStore(redis as never, 60, fallback);
    return { store, redis, fallback };
  };

  it('read uses redis when available', async () => {
    const { store } = make();
    await expect(store.read('k')).resolves.toEqual({ failureCount: 3, secondsUntilReset: 9 });
  });

  it('read falls back to memory store when redis read fails', async () => {
    const { store, redis, fallback } = make();
    redis.get.mockRejectedValueOnce(new Error('down'));

    await expect(store.read('k')).resolves.toEqual({ failureCount: 7, secondsUntilReset: 11 });
    expect(fallback.read).toHaveBeenCalledWith('k');
  });

  it('increment sets expiry on first hit', async () => {
    const { store, redis } = make();
    redis.incr.mockResolvedValueOnce(1);

    await store.increment('k');
    expect(redis.expire).toHaveBeenCalledWith('k', 60);
  });

  it('increment uses fallback when redis increment fails', async () => {
    const { store, redis, fallback } = make();
    redis.incr.mockRejectedValueOnce(new Error('down'));

    await store.increment('k');
    expect(fallback.increment).toHaveBeenCalledWith('k');
  });

  it('remove always clears fallback and ignores redis delete failures', async () => {
    const { store, redis, fallback } = make();
    redis.del.mockRejectedValueOnce(new Error('down'));

    await expect(store.remove('k')).resolves.toBeUndefined();
    expect(fallback.remove).toHaveBeenCalledWith('k');
  });
});
