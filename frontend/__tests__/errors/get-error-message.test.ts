import { describe, expect, it } from 'vitest'
import { ApiError, DEFAULT_MESSAGE, ERROR_CODE, HTTP_STATUS, getErrorMessage } from '../../src/errors'

describe('getErrorMessage', () => {
  it('returns default message for unknown errors', () => {
    expect(getErrorMessage(new Error('x'))).toBe(DEFAULT_MESSAGE)
  })

  it('maps known api error codes to friendly messages', () => {
    const error = new ApiError(401, ERROR_CODE.INVALID_CREDENTIALS, 'raw')
    expect(getErrorMessage(error)).toBe('Incorrect email or password.')
  })

  it('returns retry-after message for rate limits with retryAfter', () => {
    const error = new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODE.UNKNOWN, 'raw', 15)
    expect(getErrorMessage(error)).toBe('Too many attempts. Try again in 15 seconds.')
  })

  it('returns service unavailable message for 5xx errors', () => {
    const error = new ApiError(HTTP_STATUS.SERVER_ERROR, ERROR_CODE.UNKNOWN, 'backend failed')
    expect(getErrorMessage(error)).toBe('The service is temporarily unavailable. Please try again shortly.')
  })
})
