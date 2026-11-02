import { MS_PER_SECOND } from '../../constants/time.constants';

export interface CounterReading {
  failureCount: number;
  secondsUntilReset: number;
}

export interface CounterStore {
  read(key: string): Promise<CounterReading>;
  increment(key: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const COUNTER_STORE = Symbol('COUNTER_STORE');

interface MemoryEntry {
  failureCount: number;
  resetAtMs: number;
}

export class MemoryCounterStore implements CounterStore {
  private readonly entries = new Map<string, MemoryEntry>();

  constructor(
    private readonly windowSeconds: number,
    private readonly maxKeys: number,
  ) {}

  async read(key: string): Promise<CounterReading> {
    const entry = this.liveEntry(key);
    if (!entry) return { failureCount: 0, secondsUntilReset: 0 };
    return {
      failureCount: entry.failureCount,
      secondsUntilReset: Math.ceil((entry.resetAtMs - Date.now()) / MS_PER_SECOND),
    };
  }

  async increment(key: string): Promise<void> {
    const entry = this.liveEntry(key);
    if (entry) {
      entry.failureCount++;
      return;
    }
    if (this.entries.size >= this.maxKeys) this.evict();
    this.entries.set(key, { failureCount: 1, resetAtMs: Date.now() + this.windowSeconds * MS_PER_SECOND });
  }

  async remove(key: string): Promise<void> {
    this.entries.delete(key);
  }

  private liveEntry(key: string): MemoryEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.resetAtMs <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.resetAtMs <= now) this.entries.delete(key);
    }
    if (this.entries.size >= this.maxKeys) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) this.entries.delete(oldestKey);
    }
  }
}
