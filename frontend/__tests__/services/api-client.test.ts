import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, ERROR_CODE, HTTP_STATUS } from '../../src/errors'
import { createApiClient } from '../../src/services/api-client'
import { createApiRequestExecutor } from '../../src/services/api-request-executor'

vi.mock('../../src/services/api-request-executor', () => ({
  createApiRequestExecutor: vi.fn(),
}))

type MockExecutor = {
  execute: ReturnType<typeof vi.fn>
  addMiddleware: ReturnType<typeof vi.fn>
  setMiddlewares: ReturnType<typeof vi.fn>
}

const createExecutorMock = (): MockExecutor => ({
  execute: vi.fn(),
  addMiddleware: vi.fn(),
  setMiddlewares: vi.fn(),
})

describe('api-client refresh/session behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not expire session for transient refresh failures', async () => {
    const executor = createExecutorMock()
    vi.mocked(createApiRequestExecutor).mockReturnValue(executor as never)

    const sessionExpiredHandler = vi.fn()

    executor.execute
      .mockRejectedValueOnce(
        new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.ACCESS_TOKEN_INVALID, 'access token expired')
      )
      .mockRejectedValueOnce(
        new ApiError(0, ERROR_CODE.NETWORK_ERROR, 'temporary network error')
      )

    const client = createApiClient({
      apiBaseUrl: 'http://localhost:3000',
      timeoutMs: 500,
      maxAttempts: 1,
      baseDelayMs: 1,
    })

    client.setAccessToken('expired-token')
    client.setSessionExpiredHandler(sessionExpiredHandler)

    await expect(client.request('/users/me', { auth: true })).rejects.toBeInstanceOf(ApiError)
    expect(sessionExpiredHandler).not.toHaveBeenCalled()
  })

  it('expires session when refresh fails with terminal auth error', async () => {
    const executor = createExecutorMock()
    vi.mocked(createApiRequestExecutor).mockReturnValue(executor as never)

    const sessionExpiredHandler = vi.fn()

    executor.execute
      .mockRejectedValueOnce(
        new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.ACCESS_TOKEN_INVALID, 'access token expired')
      )
      .mockRejectedValueOnce(
        new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.ACCESS_TOKEN_INVALID, 'refresh denied')
      )

    const client = createApiClient({
      apiBaseUrl: 'http://localhost:3000',
      timeoutMs: 500,
      maxAttempts: 1,
      baseDelayMs: 1,
    })

    client.setAccessToken('expired-token')
    client.setSessionExpiredHandler(sessionExpiredHandler)

    await expect(client.request('/users/me', { auth: true })).rejects.toBeInstanceOf(ApiError)
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1)
  })

  it('expires session when retry after refresh is still unauthorized', async () => {
    const executor = createExecutorMock()
    vi.mocked(createApiRequestExecutor).mockReturnValue(executor as never)

    const sessionExpiredHandler = vi.fn()

    executor.execute
      .mockRejectedValueOnce(
        new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.ACCESS_TOKEN_INVALID, 'access token expired')
      )
      .mockResolvedValueOnce({ accessToken: 'fresh-token' })
      .mockRejectedValueOnce(
        new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.ACCESS_TOKEN_INVALID, 'still unauthorized')
      )

    const client = createApiClient({
      apiBaseUrl: 'http://localhost:3000',
      timeoutMs: 500,
      maxAttempts: 1,
      baseDelayMs: 1,
    })

    client.setAccessToken('expired-token')
    client.setSessionExpiredHandler(sessionExpiredHandler)

    await expect(client.request('/users/me', { auth: true })).rejects.toBeInstanceOf(ApiError)
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1)
  })
})
