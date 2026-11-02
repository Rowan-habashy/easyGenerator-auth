import { AUTH_ROUTE } from '../auth/auth.constants';
import { loadConfig } from './app-config';

describe('loadConfig', () => {
  const baseEnv = {
    FRONTEND_ORIGIN: 'https://app.example.com',
    MONGODB_URI: 'mongodb://localhost/test',
    JWT_SECRET: 'secret-secret-secret-secret',
  } as Record<string, string>;

  const cfgService = (env: Record<string, string | undefined>) => ({
    get: (k: string) => env[k],
  });

  it('loads defaults and required values', () => {
    const cfg = loadConfig(cfgService(baseEnv) as never);
    expect(cfg.port).toBe(3000);
    expect(cfg.cookie.path).toBe(`/${AUTH_ROUTE}`);
    expect(cfg.rateLimitStore).toBe('memory');
    expect(cfg.redisUrl).toBe('');
  });

  it('requires REDIS_URL when RATE_LIMIT_STORE=redis', () => {
    expect(() => loadConfig(cfgService({ ...baseEnv, RATE_LIMIT_STORE: 'redis' }) as never)).toThrow('REDIS_URL');
  });

  it('rejects invalid numeric and enum values', () => {
    expect(() => loadConfig(cfgService({ ...baseEnv, PORT: '-1' }) as never)).toThrow('PORT');
    expect(() => loadConfig(cfgService({ ...baseEnv, COOKIE_SAME_SITE: 'weird' }) as never)).toThrow('COOKIE_SAME_SITE');
  });

  it('accepts explicit redis config', () => {
    const cfg = loadConfig(cfgService({ ...baseEnv, RATE_LIMIT_STORE: 'redis', REDIS_URL: 'redis://localhost:6379' }) as never);
    expect(cfg.rateLimitStore).toBe('redis');
    expect(cfg.redisUrl).toBe('redis://localhost:6379');
  });
});
