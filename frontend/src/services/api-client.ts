import { ApiError, ERROR_CODE, HTTP_STATUS } from '../errors'
import type { ApiMiddleware } from '../middleware'
import {
  isAccessTokenExpired,
  isRetryableError,
  retryAfterMs,
  type RequestOptions,
} from '../lib/api-helpers'
import { retryWithBackoff } from '../lib/retry'
import { createApiRequestExecutor } from './api-request-executor'

interface SessionPayload {
  accessToken: string
}

interface CreateApiClientInput {
  apiBaseUrl: string
  timeoutMs: number
  maxAttempts: number
  baseDelayMs: number
}

export interface ApiClient {
  setAccessToken(token: string | null): void
  addApiMiddleware(middleware: ApiMiddleware): () => void
  setApiMiddlewares(middlewares: ApiMiddleware[]): void
  refreshSession(): Promise<void>
  setSessionExpiredHandler(handler: () => void): void
  request<T>(path: string, options?: RequestOptions): Promise<T>
  authenticate<TUser>(path: '/auth/signin' | '/auth/signup', body: unknown): Promise<{ accessToken: string; user: TUser }>
}

export function createApiClient({ apiBaseUrl, timeoutMs, maxAttempts, baseDelayMs }: CreateApiClientInput): ApiClient {
  let accessToken: string | null = null
  let refreshing: Promise<void> | null = null
  let onSessionExpired: () => void = () => {}

  const requestExecutor = createApiRequestExecutor({
    apiBaseUrl,
    timeoutMs,
    getAccessToken: () => accessToken,
  })

  const withBackoff = <T>(run: () => Promise<T>) =>
    retryWithBackoff(run, {
      maxAttempts,
      baseDelayMs,
      shouldRetry: isRetryableError,
      getRetryAfterMs: (error) => retryAfterMs(error as ApiError),
    })

  const updateAccessToken = (token: string | null) => {
    accessToken = token
  }

  const shouldEndSessionOnRefreshFailure = (error: unknown) => {
    if (!(error instanceof ApiError)) return false
    return (
      error.status === HTTP_STATUS.UNAUTHORIZED ||
      error.status === HTTP_STATUS.CONFLICT ||
      error.code === ERROR_CODE.REFRESH_OUTCOME_UNKNOWN
    )
  }

  const requestWithBackoff = <T>(path: string, options: RequestOptions) => withBackoff(() => requestExecutor.execute<T>(path, options))

  const refreshSession = (): Promise<void> => {
    refreshing ??= requestWithBackoff<SessionPayload>('/auth/refresh', { method: 'POST' })
      .then((result) => {
        updateAccessToken(result.accessToken)
      })
      .finally(() => {
        refreshing = null
      })

    return refreshing
  }

  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    if (!options.auth) return requestExecutor.execute<T>(path, options)

    try {
      return await requestWithBackoff<T>(path, options)
    } catch (error) {
      if (!isAccessTokenExpired(error)) throw error
    }

    try {
      await refreshSession()
    } catch (error) {
      if (shouldEndSessionOnRefreshFailure(error)) {
        onSessionExpired()
      }
      throw error
    }

    try {
      return await requestWithBackoff<T>(path, options)
    } catch (error) {
      if (isAccessTokenExpired(error)) {
        onSessionExpired()
      }
      throw error
    }
  }

  const authenticate = async <TUser>(path: '/auth/signin' | '/auth/signup', body: unknown) => {
    const session = await request<{ accessToken: string; user: TUser }>(path, { method: 'POST', body })
    updateAccessToken(session.accessToken)
    return session
  }

  return {
    setAccessToken: updateAccessToken,
    addApiMiddleware(middleware) {
      return requestExecutor.addMiddleware(middleware)
    },
    setApiMiddlewares(middlewares) {
      requestExecutor.setMiddlewares(middlewares)
    },
    refreshSession,
    setSessionExpiredHandler(handler) {
      onSessionExpired = handler
    },
    request,
    authenticate,
  }
}
