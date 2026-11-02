import { ConfigService } from '@nestjs/config';
import { AUTH_ROUTE } from '../auth/auth.constants';

export const APP_CONFIG = Symbol('APP_CONFIG');

export const RATE_LIMIT_STORES = ['memory', 'redis'] as const;
export type RateLimitStore = (typeof RATE_LIMIT_STORES)[number];

export interface AppConfig {
  port: number;
  frontendOrigin: string;
  mongoUri: string;
  rateLimitStore: RateLimitStore;
  redisUrl: string;
  trustProxyHops: number;
  jwt: { secret: string; expiresIn: string; algorithm: 'HS256' | 'HS384' | 'HS512' };
  cookie: { name: string; path: string; secure: boolean; sameSite: 'strict' | 'lax' | 'none' };
  hsts: { maxAgeSeconds: number };
  auth: {
    sessionTtlMs: number;
    refreshTtlMs: number;
    refreshGraceMs: number;
    refreshTokenBytes: number;
    bcryptRounds: number;
    maxTxAttempts: number;
    maxCommitRetries: number;
    purgeAfterSeconds: number;
  };
  throttle: { ttlMs: number; limit: number };
  signin: { maxPerIp: number; maxPerEmail: number; windowSeconds: number; maxMemoryKeys: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function str(c: ConfigService, key: string, fallback?: string): string {
  const v = c.get<string>(key) ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing required environment variable ${key}`);
  return v;
}

function num(c: ConfigService, key: string, fallback: number): number {
  const raw = c.get<string>(key);
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Environment variable ${key} must be a non-negative number`);
  return n;
}

function oneOf<T extends string>(c: ConfigService, key: string, allowed: readonly T[], fallback: T): T {
  const v = (c.get<string>(key) ?? fallback) as T;
  if (!allowed.includes(v)) throw new Error(`Environment variable ${key} must be one of: ${allowed.join(', ')}`);
  return v;
}

export function loadConfig(c: ConfigService): AppConfig {
  const rateLimitStore = oneOf(c, 'RATE_LIMIT_STORE', RATE_LIMIT_STORES, 'memory');
  return {
    port: num(c, 'PORT', 3000),
    frontendOrigin: str(c, 'FRONTEND_ORIGIN'),
    mongoUri: str(c, 'MONGODB_URI'),
    rateLimitStore,
    // REDIS_URL is only required when RATE_LIMIT_STORE=redis
    redisUrl: rateLimitStore === 'redis' ? str(c, 'REDIS_URL') : (c.get<string>('REDIS_URL') ?? ''),
    trustProxyHops: num(c, 'TRUST_PROXY_HOPS', 1),
    jwt: {
      secret: str(c, 'JWT_SECRET'),
      expiresIn: str(c, 'JWT_ACCESS_EXPIRES_IN', '15m'),
      algorithm: oneOf(c, 'JWT_ALGORITHM', ['HS256', 'HS384', 'HS512'] as const, 'HS256'),
    },
    cookie: {
      name: str(c, 'REFRESH_COOKIE_NAME', 'refresh_token'),
      path: str(c, 'REFRESH_COOKIE_PATH', `/${AUTH_ROUTE}`),
      secure: str(c, 'COOKIE_SECURE', 'true') !== 'false',
      sameSite: oneOf(c, 'COOKIE_SAME_SITE', ['strict', 'lax', 'none'] as const, 'strict'),
    },
    hsts: { maxAgeSeconds: num(c, 'HSTS_MAX_AGE_SECONDS', 365 * 24 * 60 * 60) },
    auth: {
      sessionTtlMs: num(c, 'SESSION_TTL_DAYS', 30) * DAY_MS,
      refreshTtlMs: num(c, 'REFRESH_TTL_DAYS', 7) * DAY_MS,
      refreshGraceMs: num(c, 'REFRESH_GRACE_SECONDS', 10) * 1000,
      refreshTokenBytes: num(c, 'REFRESH_TOKEN_BYTES', 48),
      bcryptRounds: num(c, 'BCRYPT_ROUNDS', 12),
      maxTxAttempts: num(c, 'MAX_TX_ATTEMPTS', 3),
      maxCommitRetries: num(c, 'MAX_COMMIT_RETRIES', 3),
      purgeAfterSeconds: num(c, 'PURGE_AFTER_DAYS', 7) * 24 * 60 * 60,
    },
    throttle: {
      ttlMs: num(c, 'THROTTLE_TTL_SECONDS', 60) * 1000,
      limit: num(c, 'THROTTLE_LIMIT', 100),
    },
    signin: {
      maxPerIp: num(c, 'SIGNIN_MAX_FAILURES_PER_IP', 5),
      maxPerEmail: num(c, 'SIGNIN_MAX_FAILURES_PER_EMAIL', 10),
      windowSeconds: num(c, 'SIGNIN_FAILURE_WINDOW_MINUTES', 15) * 60,
      maxMemoryKeys: num(c, 'SIGNIN_MAX_MEMORY_KEYS', 10_000),
    },
  };
}
