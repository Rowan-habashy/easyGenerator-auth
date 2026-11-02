import { ApiError, DEFAULT_MESSAGE, ERROR_CODE, HTTP_STATUS } from './errors'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

const MAX_ATTEMPTS = Number(import.meta.env.VITE_RETRY_MAX_ATTEMPTS ?? 3)
const BASE_DELAY_MS = Number(import.meta.env.VITE_RETRY_BASE_DELAY_MS ?? 500)
const TIMEOUT_MS = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS ?? 10000)

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  auth?: boolean
}

let accessToken: string | null = null
export const setAccessToken = (token: string | null) => {
  accessToken = token
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function sendOnce<T>(path: string, { method = 'GET', body, auth }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new ApiError(0, timedOut ? ERROR_CODE.TIMEOUT : ERROR_CODE.NETWORK_ERROR, timedOut ? 'The request timed out.' : 'Cannot reach the server.')
  }

  if (response.status === HTTP_STATUS.NO_CONTENT) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const retryAfter = Number(response.headers.get('Retry-After')) || undefined
    throw new ApiError(response.status, data?.code ?? ERROR_CODE.UNKNOWN, data?.message ?? DEFAULT_MESSAGE, retryAfter)
  }
  return data as T
}

async function withBackoff<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      const retryable = error instanceof ApiError && (error.status === HTTP_STATUS.TOO_MANY_REQUESTS || (error.status === HTTP_STATUS.SERVICE_UNAVAILABLE && error.code === ERROR_CODE.SERVICE_UNAVAILABLE))
      if (!retryable || attempt >= MAX_ATTEMPTS) throw error
      await sleep(Math.max(BASE_DELAY_MS * 2 ** (attempt - 1), (error.retryAfter ?? 0) * 1000))
    }
  }
}

let refreshing: Promise<void> | null = null
export function refreshSession(): Promise<void> {
  refreshing ??= withBackoff(() => sendOnce<{ accessToken: string }>('/auth/refresh', { method: 'POST' }))
    .then((result) => setAccessToken(result.accessToken))
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

let onSessionExpired: () => void = () => {}
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!options.auth) return sendOnce<T>(path, options)
  try {
    return await withBackoff(() => sendOnce<T>(path, options))
  } catch (error) {
    const expired = error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED && error.code === ERROR_CODE.ACCESS_TOKEN_INVALID
    if (!expired) throw error
  }
  try {
    await refreshSession()
  } catch (error) {
    onSessionExpired()
    throw error
  }
  return withBackoff(() => sendOnce<T>(path, options))
}

/** Sign in or sign up: stores the access token in memory and returns the user. */
export async function authenticate(path: '/auth/signin' | '/auth/signup', body: unknown): Promise<User> {
  const session = await request<{ accessToken: string; user: User }>(path, { method: 'POST', body })
  setAccessToken(session.accessToken)
  return session.user
}
