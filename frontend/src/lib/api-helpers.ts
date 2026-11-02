import { ApiError, DEFAULT_MESSAGE, ERROR_CODE, HTTP_STATUS } from '../errors'
import type { ApiRequestContext } from '../middleware'

export interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  auth?: boolean
}

export interface CreateRequestContextInput {
  accessToken: string | null
  apiBaseUrl: string
  path: string
  options: RequestOptions
  timeoutMs: number
}

export const isRetryableError = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  (error.status === HTTP_STATUS.TOO_MANY_REQUESTS ||
    (error.status === HTTP_STATUS.SERVICE_UNAVAILABLE && error.code === ERROR_CODE.SERVICE_UNAVAILABLE))

export const retryAfterMs = (error: ApiError) => (error.retryAfter ?? 0) * 1000

export const isAccessTokenExpired = (error: unknown) =>
  error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED && error.code === ERROR_CODE.ACCESS_TOKEN_INVALID

export const createRequestContext = ({
  accessToken,
  apiBaseUrl,
  path,
  options,
  timeoutMs,
}: CreateRequestContextInput): ApiRequestContext => {
  const { method = 'GET', body, auth } = options
  const headers: Record<string, string> = {}

  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`

  return {
    url: `${apiBaseUrl}${path}`,
    init: {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: AbortSignal.timeout(timeoutMs),
    },
  }
}

export const toNetworkApiError = (error: unknown) => {
  const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
  return new ApiError(
    0,
    timedOut ? ERROR_CODE.TIMEOUT : ERROR_CODE.NETWORK_ERROR,
    timedOut ? 'The request timed out.' : 'Cannot reach the server.',
  )
}

export const parseResponseBody = async (response: Response) => response.json().catch(() => null)

export const toApiResponseError = async (response: Response) => {
  const data = await parseResponseBody(response)
  const retryAfter = Number(response.headers.get('Retry-After')) || undefined
  return new ApiError(response.status, data?.code ?? ERROR_CODE.UNKNOWN, data?.message ?? DEFAULT_MESSAGE, retryAfter)
}
