import { OriginRejectedError } from '../errors/auth-errors';
import { makeConfig } from '../../test/test-helpers';
import { OriginGuard } from './origin.guard';

describe('OriginGuard', () => {
  const cfg = makeConfig();

  const makeCtx = (req: any): any => ({
    switchToHttp: () => ({ getRequest: () => req }),
  });

  it('allows non-protected routes and non-POST methods', () => {
    const guard = new OriginGuard(cfg);
    expect(guard.canActivate(makeCtx({ method: 'GET', path: '/api/auth/refresh', headers: {} }))).toBe(true);
    expect(guard.canActivate(makeCtx({ method: 'POST', path: '/health', headers: {} }))).toBe(true);
  });

  it('allows protected POST when origin matches', () => {
    const guard = new OriginGuard(cfg);
    const req = { method: 'POST', path: `${cfg.cookie.path}/refresh`, headers: { origin: cfg.frontendOrigin } };
    expect(guard.canActivate(makeCtx(req))).toBe(true);
  });

  it('rejects protected POST when origin mismatches', () => {
    const guard = new OriginGuard(cfg);
    const req = { method: 'POST', path: `${cfg.cookie.path}/refresh`, headers: { origin: 'https://evil.test' } };
    expect(() => guard.canActivate(makeCtx(req))).toThrow(OriginRejectedError);
  });
});
