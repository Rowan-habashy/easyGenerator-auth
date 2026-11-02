import type { ApiMiddleware } from './middleware'
import type { RequestOptions } from './lib/api-helpers'
import { createApiClient } from './services/api-client'

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

const apiClient = createApiClient({
  apiBaseUrl: API_BASE_URL,
  timeoutMs: TIMEOUT_MS,
  maxAttempts: MAX_ATTEMPTS,
  baseDelayMs: BASE_DELAY_MS,
})

export const setAccessToken = (token: string | null) => apiClient.setAccessToken(token)
export const addApiMiddleware = (middleware: ApiMiddleware) => apiClient.addApiMiddleware(middleware)
export const setApiMiddlewares = (middlewares: ApiMiddleware[]) => apiClient.setApiMiddlewares(middlewares)
export const refreshSession = () => apiClient.refreshSession()
export const setSessionExpiredHandler = (handler: () => void) => apiClient.setSessionExpiredHandler(handler)
export const request = <T>(path: string, options: RequestOptions = {}) => apiClient.request<T>(path, options)

export async function authenticate(path: '/auth/signin' | '/auth/signup', body: unknown): Promise<User> {
  const session = await apiClient.authenticate<User>(path, body)
  return session.user
}
