import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  const makeSut = () => {
    const redis = {
      incr: jest.fn(async () => 1),
      pexpire: jest.fn(async () => 1),
      pttl: jest.fn(async () => 2000),
    };
    const storage = new RedisThrottlerStorage(redis as never);
    return { storage, redis };
  };

  it('increments, sets expiry, and returns non-blocked record when under limit', async () => {
    const { storage, redis } = makeSut();
    const rec = await storage.increment('ip:1', 5000, 5, 5000, 'signin');

    expect(redis.incr).toHaveBeenCalled();
    expect(redis.pexpire).toHaveBeenCalled();
    expect(rec.totalHits).toBe(1);
    expect(rec.isBlocked).toBe(false);
    expect(rec.timeToExpire).toBe(2);
  });

  it('flags blocked when hits exceed limit', async () => {
    const { storage, redis } = makeSut();
    redis.incr.mockResolvedValueOnce(7);
    redis.pttl.mockResolvedValueOnce(3000);

    const rec = await storage.increment('ip:1', 5000, 5, 5000, 'signin');
    expect(rec.isBlocked).toBe(true);
    expect(rec.timeToBlockExpire).toBe(3);
  });

  it('recovers when pttl is missing and handles redis errors', async () => {
    const { storage, redis } = makeSut();
    redis.pttl.mockResolvedValueOnce(-1);

    const rec = await storage.increment('ip:1', 5000, 5, 5000, 'signin');
    expect(redis.pexpire).toHaveBeenCalledWith(expect.any(String), 5000);
    expect(rec.timeToExpire).toBe(5);

    redis.incr.mockRejectedValueOnce(new Error('down'));
    await expect(storage.increment('ip:2', 5000, 5, 5000, 'signin')).resolves.toEqual({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });
});
