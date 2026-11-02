import { ExecutionContext } from '@nestjs/common';
import { Types } from 'mongoose';
import { AccountDisabledError, InvalidAccessTokenError } from '../common/errors/auth-errors';
import { AuthGuard } from './auth.guard';

const ctxWith = (req: any) => ({
  switchToHttp: () => ({ getRequest: () => req }),
}) as ExecutionContext;

describe('AuthGuard', () => {
  const makeSut = () => {
    const tokens = { verifyAccess: jest.fn() };
    const sessions = { findActive: jest.fn() };
    const users = { findById: jest.fn() };
    const guard = new AuthGuard(tokens as never, sessions as never, users as never);
    return { guard, tokens, sessions, users };
  };

  it('rejects when Bearer token is missing', async () => {
    const { guard } = makeSut();
    await expect(guard.canActivate(ctxWith({ headers: {} }))).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects when session is missing', async () => {
    const { guard, tokens, sessions } = makeSut();
    tokens.verifyAccess.mockResolvedValue({ sub: 'u1', sid: 's1' });
    sessions.findActive.mockResolvedValue(null);

    await expect(
      guard.canActivate(ctxWith({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects when session user mismatch', async () => {
    const { guard, tokens, sessions } = makeSut();
    tokens.verifyAccess.mockResolvedValue({ sub: 'u1', sid: 's1' });
    sessions.findActive.mockResolvedValue({ userId: new Types.ObjectId('66f66f66f66f66f66f66f66f') });

    await expect(
      guard.canActivate(ctxWith({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects when user is missing', async () => {
    const { guard, tokens, sessions, users } = makeSut();
    const userId = new Types.ObjectId().toString();
    tokens.verifyAccess.mockResolvedValue({ sub: userId, sid: 's1' });
    sessions.findActive.mockResolvedValue({ userId: new Types.ObjectId(userId) });
    users.findById.mockResolvedValue(null);

    await expect(
      guard.canActivate(ctxWith({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects disabled user with 403 AccountDisabledError', async () => {
    const { guard, tokens, sessions, users } = makeSut();
    const userId = new Types.ObjectId().toString();
    tokens.verifyAccess.mockResolvedValue({ sub: userId, sid: 's1' });
    sessions.findActive.mockResolvedValue({ userId: new Types.ObjectId(userId) });
    users.findById.mockResolvedValue({ id: userId, isDisabled: true });

    await expect(
      guard.canActivate(ctxWith({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(AccountDisabledError);
  });

  it('sets req.auth and returns true for valid token/session/user', async () => {
    const { guard, tokens, sessions, users } = makeSut();
    const userId = new Types.ObjectId().toString();
    const req: any = { headers: { authorization: 'Bearer token' } };
    tokens.verifyAccess.mockResolvedValue({ sub: userId, sid: 's1' });
    sessions.findActive.mockResolvedValue({ userId: new Types.ObjectId(userId) });
    users.findById.mockResolvedValue({ id: userId, isDisabled: false });

    await expect(guard.canActivate(ctxWith(req))).resolves.toBe(true);
    expect(req.auth).toEqual({ userId, sessionId: 's1' });
  });
});
