export const AUTH_ROUTE = 'api/auth';

export const REVOKE_REASON = { logout: 'logout', replay: 'replay' } as const;

export const VALIDATION = {
  emailMax: 254,
  nameMin: 3,
  nameMax: 100,
  passwordMin: 8,
  passwordMax: 72,
} as const;
