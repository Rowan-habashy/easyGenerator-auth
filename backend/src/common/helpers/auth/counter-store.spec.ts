import { MemoryCounterStore } from './counter-store';

describe('MemoryCounterStore', () => {
  it('increments and reads counters', async () => {
    const store = new MemoryCounterStore(60, 10);
    await store.increment('ip:1');
    await store.increment('ip:1');

    await expect(store.read('ip:1')).resolves.toMatchObject({ failureCount: 2 });
  });

  it('remove deletes the counter', async () => {
    const store = new MemoryCounterStore(60, 10);
    await store.increment('ip:1');
    await store.remove('ip:1');

    await expect(store.read('ip:1')).resolves.toEqual({ failureCount: 0, secondsUntilReset: 0 });
  });

  it('expires counters after the window', async () => {
    const store = new MemoryCounterStore(0, 10);
    await store.increment('ip:1');

    await expect(store.read('ip:1')).resolves.toEqual({ failureCount: 0, secondsUntilReset: 0 });
  });

  it('evicts when max keys is reached', async () => {
    const store = new MemoryCounterStore(60, 2);
    await store.increment('a');
    await store.increment('b');
    await store.increment('c');

    expect((store as any).entries.size).toBeLessThanOrEqual(2);
  });
});
