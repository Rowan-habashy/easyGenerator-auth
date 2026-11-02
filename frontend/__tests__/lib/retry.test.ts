import { describe, expect, it, vi } from 'vitest'
import { retryWithBackoff } from '../../src/lib/retry'

describe('retryWithBackoff', () => {
  it('retries retryable failures until success', async () => {
    let attempts = 0
    const run = vi.fn(async () => {
      attempts += 1
      if (attempts < 3) throw new Error('transient')
      return 'ok'
    })

    const result = await retryWithBackoff(run, {
      maxAttempts: 3,
      baseDelayMs: 0,
      shouldRetry: () => true,
    })

    expect(result).toBe('ok')
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('throws immediately when shouldRetry is false', async () => {
    const run = vi.fn(async () => {
      throw new Error('fatal')
    })

    await expect(
      retryWithBackoff(run, {
        maxAttempts: 3,
        baseDelayMs: 0,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('fatal')

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('stops at maxAttempts and rethrows', async () => {
    const run = vi.fn(async () => {
      throw new Error('still failing')
    })

    await expect(
      retryWithBackoff(run, {
        maxAttempts: 2,
        baseDelayMs: 0,
        shouldRetry: () => true,
      }),
    ).rejects.toThrow('still failing')

    expect(run).toHaveBeenCalledTimes(2)
  })
})
