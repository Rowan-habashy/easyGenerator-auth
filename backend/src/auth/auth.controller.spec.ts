import { InvalidCredentialsError, ServiceUnavailableError } from '../common/errors/auth-errors';
import { makeConfig } from '../test/test-helpers';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const cfg = makeConfig();

  const makeSut = () => {
    const auth = {
      signUp: jest.fn(),
      signIn: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    const limiter = {
      assertAllowed: jest.fn(),
      recordFailure: jest.fn(),
      reset: jest.fn(),
    };
    const controller = new AuthController(auth as never, limiter as never, cfg);
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() };
    return { controller, auth, limiter, res };
  };

  it('signUp sets refresh cookie and returns accessToken + user', async () => {
    const { controller, auth, res } = makeSut();
    auth.signUp.mockResolvedValue({
      accessToken: 'a1',
      refreshToken: 'r1',
      user: { id: 'u1', email: 'rowan@example.com', name: 'Rowan', createdAt: new Date() },
    });

    const body = await controller.signUp({ email: 'rowan@example.com', name: 'Rowan', password: 'Password123' }, res);

    expect(res.cookie).toHaveBeenCalledWith(cfg.cookie.name, 'r1', expect.objectContaining({
      httpOnly: true,
      secure: cfg.cookie.secure,
      sameSite: cfg.cookie.sameSite,
      path: cfg.cookie.path,
      maxAge: cfg.auth.refreshTtlMs,
    }));
    expect(body).toEqual(expect.objectContaining({ accessToken: 'a1' }));
  });

  it('signIn records failure on InvalidCredentialsError and rethrows', async () => {
    const { controller, auth, limiter, res } = makeSut();
    auth.signIn.mockRejectedValue(new InvalidCredentialsError());
    const req: any = { ip: '1.1.1.1' };

    await expect(controller.signIn({ email: 'rowan@example.com', password: 'wrong' }, req, res)).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );

    expect(limiter.assertAllowed).toHaveBeenCalledWith('1.1.1.1', 'rowan@example.com');
    expect(limiter.recordFailure).toHaveBeenCalledWith('1.1.1.1', 'rowan@example.com');
    expect(limiter.reset).not.toHaveBeenCalled();
  });

  it('signIn on success resets limiter and returns session body', async () => {
    const { controller, auth, limiter, res } = makeSut();
    auth.signIn.mockResolvedValue({
      accessToken: 'a1',
      refreshToken: 'r1',
      user: { id: 'u1', email: 'rowan@example.com', name: 'Rowan', createdAt: new Date() },
    });
    const req: any = { ip: '1.1.1.1' };

    const body = await controller.signIn({ email: 'rowan@example.com', password: 'Password123' }, req, res);

    expect(limiter.assertAllowed).toHaveBeenCalledWith('1.1.1.1', 'rowan@example.com');
    expect(limiter.reset).toHaveBeenCalledWith('1.1.1.1', 'rowan@example.com');
    expect(body).toEqual(expect.objectContaining({ accessToken: 'a1' }));
  });

  it('refresh sets cookie and returns access token only', async () => {
    const { controller, auth, res } = makeSut();
    auth.refresh.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });
    const req: any = { cookies: { [cfg.cookie.name]: 'r1' } };

    const body = await controller.refresh(req, res);

    expect(auth.refresh).toHaveBeenCalledWith('r1');
    expect(res.cookie).toHaveBeenCalledWith(cfg.cookie.name, 'r2', expect.objectContaining({ maxAge: cfg.auth.refreshTtlMs }));
    expect(body).toEqual({ accessToken: 'a2' });
  });

  it('logout always clears cookie, even when service throws', async () => {
    const { controller, auth, res } = makeSut();
    auth.logout.mockRejectedValue(new ServiceUnavailableError());
    const req: any = { headers: { authorization: 'Bearer a1' }, cookies: { [cfg.cookie.name]: 'r1' } };

    await expect(controller.logout(req, res)).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(res.clearCookie).toHaveBeenCalledWith(cfg.cookie.name, {
      httpOnly: true,
      secure: cfg.cookie.secure,
      sameSite: cfg.cookie.sameSite,
      path: cfg.cookie.path,
    });
  });
});
