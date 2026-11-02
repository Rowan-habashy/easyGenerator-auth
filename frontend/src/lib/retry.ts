const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface RetryOptions<E = unknown> {
  maxAttempts: number
  baseDelayMs: number
  shouldRetry: (error: E) => boolean
  getRetryAfterMs?: (error: E) => number | undefined
}

export async function retryWithBackoff<T, E = unknown>(
  run: () => Promise<T>,
  options: RetryOptions<E>,
): Promise<T> {
  const { maxAttempts, baseDelayMs, shouldRetry, getRetryAfterMs } = options

  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      const typedError = error as E
      if (!shouldRetry(typedError) || attempt >= maxAttempts) throw error

      const retryAfterMs = getRetryAfterMs?.(typedError) ?? 0
      const backoffMs = baseDelayMs * 2 ** (attempt - 1)
      await sleep(Math.max(backoffMs, retryAfterMs))
    }
  }
}
