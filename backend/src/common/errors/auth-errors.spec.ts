import {
  AccountDisabledError,
  AuthError,
  EmailTakenError,
  InvalidAccessTokenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  OriginRejectedError,
  OutcomeUncertainError,
  RateLimitedError,
  RefreshConflictError,
  ServiceUnavailableError,
  ValidationError,
} from './auth-errors';

describe('auth-errors', () => {
  it('constructs all error classes with expected code/status defaults', () => {
    expect(new ValidationError().status).toBe(400);
    expect(new OriginRejectedError().code).toBe('ORIGIN_REJECTED');
    expect(new AccountDisabledError().status).toBe(403);
    expect(new InvalidCredentialsError().status).toBe(401);
    expect(new InvalidAccessTokenError().code).toBe('ACCESS_TOKEN_INVALID');
    expect(new InvalidRefreshTokenError().clearCookie).toBe(true);
    expect(new EmailTakenError().status).toBe(409);
    expect(new RefreshConflictError().code).toBe('REFRESH_CONFLICT');
    expect(new OutcomeUncertainError().status).toBe(503);
    expect(new ServiceUnavailableError().code).toBe('SERVICE_UNAVAILABLE');
  });

  it('RateLimitedError stores retryAfterSeconds', () => {
    const e = new RateLimitedError(42);
    expect(e).toBeInstanceOf(AuthError);
    expect(e.status).toBe(429);
    expect(e.retryAfterSeconds).toBe(42);
  });

  it('ValidationError joins array messages', () => {
    const e = new ValidationError(['a', 'b']);
    expect(e.message).toBe('a; b');
  });
});
