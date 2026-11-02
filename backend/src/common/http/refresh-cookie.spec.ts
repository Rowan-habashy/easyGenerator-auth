import { makeConfig } from '../../test/test-helpers';
import { clearRefreshCookie, setRefreshCookie } from './refresh-cookie';

describe('refresh-cookie helpers', () => {
  const cfg = makeConfig();

  it('setRefreshCookie writes cookie with secure options and maxAge', () => {
    const res: any = { cookie: jest.fn() };
    setRefreshCookie(res, cfg, 'r1');

    expect(res.cookie).toHaveBeenCalledWith(
      cfg.cookie.name,
      'r1',
      expect.objectContaining({
        httpOnly: true,
        secure: cfg.cookie.secure,
        sameSite: cfg.cookie.sameSite,
        path: cfg.cookie.path,
        maxAge: cfg.auth.refreshTtlMs,
      }),
    );
  });

  it('clearRefreshCookie clears cookie with same options', () => {
    const res: any = { clearCookie: jest.fn() };
    clearRefreshCookie(res, cfg);

    expect(res.clearCookie).toHaveBeenCalledWith(
      cfg.cookie.name,
      expect.objectContaining({
        httpOnly: true,
        secure: cfg.cookie.secure,
        sameSite: cfg.cookie.sameSite,
        path: cfg.cookie.path,
      }),
    );
  });
});
