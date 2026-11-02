export class AuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly clearCookie = false,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export class ValidationError extends AuthError {
  constructor(message: string | string[] = 'Validation failed') {
    super(400, 'VALIDATION_ERROR', Array.isArray(message) ? message.join('; ') : message);
  }
}
export class OriginRejectedError extends AuthError {
  constructor() {
    super(403, 'ORIGIN_REJECTED', 'Origin not allowed');
  }
}
export class AccountDisabledError extends AuthError {
  constructor() {
    super(403, 'ACCOUNT_DISABLED', 'Account is disabled');
  }
}
export class InvalidCredentialsError extends AuthError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
}
export class InvalidAccessTokenError extends AuthError {
  constructor() {
    super(401, 'ACCESS_TOKEN_INVALID', 'Invalid or expired access token');
  }
}
export class InvalidRefreshTokenError extends AuthError {
  constructor() {
    super(401, 'REFRESH_TOKEN_INVALID', 'Invalid refresh token', true);
  }
}
export class EmailTakenError extends AuthError {
  constructor() {
    super(409, 'EMAIL_TAKEN', 'Email is already registered');
  }
}
export class RefreshConflictError extends AuthError {
  constructor() {
    super(409, 'REFRESH_CONFLICT', 'Refresh token was already used');
  }
}
export class RateLimitedError extends AuthError {
  constructor(retryAfterSeconds: number) {
    super(429, 'RATE_LIMITED', 'Too many requests', false, retryAfterSeconds);
  }
}
export class OutcomeUncertainError extends AuthError {
  constructor() {
    super(503, 'REFRESH_OUTCOME_UNKNOWN', 'Refresh outcome unknown, sign in again');
  }
}
export class ServiceUnavailableError extends AuthError {
  constructor() {
    super(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable');
  }
}
