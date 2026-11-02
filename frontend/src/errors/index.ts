export const HTTP_STATUS = {
  NO_CONTENT: 204,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

export const ERROR_CODE = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ORIGIN_REJECTED: 'ORIGIN_REJECTED',
  ACCESS_TOKEN_INVALID: 'ACCESS_TOKEN_INVALID',
  REFRESH_CONFLICT: 'REFRESH_CONFLICT',
  REFRESH_OUTCOME_UNKNOWN: 'REFRESH_OUTCOME_UNKNOWN',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
} as const

export class ApiError extends Error {
  status: number
  code: string
  retryAfter?: number

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODE.INVALID_CREDENTIALS]: 'Incorrect email or password.',
  [ERROR_CODE.EMAIL_TAKEN]: 'An account with this email already exists.',
  [ERROR_CODE.ACCOUNT_DISABLED]: 'This account is disabled.',
  [ERROR_CODE.ORIGIN_REJECTED]: 'Request blocked. Reload the page and try again.',
  [ERROR_CODE.REFRESH_CONFLICT]: 'We could not confirm your session. Please sign in again.',
  [ERROR_CODE.REFRESH_OUTCOME_UNKNOWN]: 'We could not confirm your session. Please sign in again.',
  [ERROR_CODE.NETWORK_ERROR]: 'Cannot reach the server. Check your connection.',
  [ERROR_CODE.TIMEOUT]: 'The server took too long to respond.',
}

export const DEFAULT_MESSAGE = 'Something went wrong. Please try again.'
const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait and try again.'
const SERVER_MESSAGE = 'The service is temporarily unavailable. Please try again shortly.'

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return DEFAULT_MESSAGE
  if (ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code]
  if (error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return error.retryAfter ? `Too many attempts. Try again in ${error.retryAfter} seconds.` : RATE_LIMIT_MESSAGE
  }
  if (error.status >= HTTP_STATUS.SERVER_ERROR) return SERVER_MESSAGE
  return error.message
}
