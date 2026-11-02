import {
  AccountDisabledError,
  EmailTakenError,
  InvalidAccessTokenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '../common/errors/auth-errors';
import { makeConfig } from '../test/test-helpers';
import { REVOKE_REASON } from './auth.constants';
import { AuthService } from './auth.service';

describe('AuthService (application orchestration)', () => {
  const cfg = makeConfig();

  const makeSut = () => {
    const users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    const sessions = {
      create: jest.fn(),
      revoke: jest.fn(),
    };
    const tokens = {
      signAccess: jest.fn(),
      createRefresh: jest.fn(),
      verifyAccess: jest.fn(),
      findByRaw: jest.fn(),
      revokeSessionTokens: jest.fn(),
    };
    const hasher = {
      hash: jest.fn(),
      compare: jest.fn(),
      compareDummy: jest.fn(),
    };
    const transactions = {
      run: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({ id: 'tx' })),
    };
    const rotation = {
      rotate: jest.fn(),
    };

    const service = new AuthService(
      users as never,
      sessions as never,
      tokens as never,
      hasher as never,
      transactions as never,
      rotation as never,
    );

    return { cfg, service, users, sessions, tokens, hasher, transactions, rotation };
  };

  it('signUp: throws EmailTakenError when email exists', async () => {
    const { service, users, hasher, transactions } = makeSut();
    users.findByEmail.mockResolvedValue({ id: 'u1' });

    await expect(service.signUp('rowan@example.com', 'Rowan', 'Password123')).rejects.toBeInstanceOf(EmailTakenError);
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(transactions.run).not.toHaveBeenCalled();
  });

  it('signUp: hashes password and opens session inside a transaction', async () => {
    const { service, users, sessions, tokens, hasher, transactions } = makeSut();
    users.findByEmail.mockResolvedValue(null);
    hasher.hash.mockResolvedValue('hashed');
    users.create.mockResolvedValue({ id: 'u1' });
    sessions.create.mockResolvedValue({ id: 's1' });
    tokens.createRefresh.mockResolvedValue({ raw: 'r1' });
    tokens.signAccess.mockResolvedValue('a1');

    await expect(service.signUp('rowan@example.com', 'Rowan', 'Password123')).resolves.toEqual(
      expect.objectContaining({ accessToken: 'a1', refreshToken: 'r1', user: expect.objectContaining({ id: 'u1' }) }),
    );
    expect(users.create).toHaveBeenCalledWith(
      { email: 'rowan@example.com', name: 'Rowan', passwordHash: 'hashed' },
      expect.anything(),
    );
    expect(sessions.create).toHaveBeenCalledWith('u1', expect.anything());
    expect(transactions.run).toHaveBeenCalledTimes(1);
  });

  it('signIn: unknown user runs compareDummy and throws InvalidCredentialsError', async () => {
    const { service, users, hasher, transactions } = makeSut();
    users.findByEmail.mockResolvedValue(null);

    await expect(service.signIn('unknown@example.com', 'Password123')).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.compareDummy).toHaveBeenCalledWith('Password123');
    expect(transactions.run).not.toHaveBeenCalled();
  });

  it('signIn: wrong password throws InvalidCredentialsError', async () => {
    const { service, users, hasher } = makeSut();
    users.findByEmail.mockResolvedValue({ id: 'u1', passwordHash: 'stored', isDisabled: false });
    hasher.compare.mockResolvedValue(false);

    await expect(service.signIn('rowan@example.com', 'wrong')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('signIn: disabled account throws AccountDisabledError', async () => {
    const { service, users, hasher } = makeSut();
    users.findByEmail.mockResolvedValue({ id: 'u1', passwordHash: 'stored', isDisabled: true });
    hasher.compare.mockResolvedValue(true);

    await expect(service.signIn('rowan@example.com', 'Password123')).rejects.toBeInstanceOf(AccountDisabledError);
  });

  it('signIn: success opens session inside a transaction', async () => {
    const { service, users, sessions, tokens, hasher, transactions } = makeSut();
    users.findByEmail.mockResolvedValue({ id: 'u1', passwordHash: 'stored', isDisabled: false });
    hasher.compare.mockResolvedValue(true);
    sessions.create.mockResolvedValue({ id: 's1' });
    tokens.createRefresh.mockResolvedValue({ raw: 'r1' });
    tokens.signAccess.mockResolvedValue('a1');

    await expect(service.signIn('rowan@example.com', 'Password123')).resolves.toEqual(
      expect.objectContaining({ accessToken: 'a1', refreshToken: 'r1', user: expect.objectContaining({ id: 'u1' }) }),
    );
    expect(transactions.run).toHaveBeenCalledTimes(1);
  });

  it('refresh: missing token throws InvalidRefreshTokenError', async () => {
    const { service, rotation, tokens } = makeSut();

    await expect(service.refresh(undefined)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(rotation.rotate).not.toHaveBeenCalled();
    expect(tokens.signAccess).not.toHaveBeenCalled();
  });

  it('refresh: rotates token then signs a new access token', async () => {
    const { service, rotation, tokens } = makeSut();
    rotation.rotate.mockResolvedValue({ refreshToken: 'r2', sessionId: 's1', userId: 'u1' });
    tokens.signAccess.mockResolvedValue('a2');

    await expect(service.refresh('r1')).resolves.toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(rotation.rotate).toHaveBeenCalledWith('r1');
    expect(tokens.signAccess).toHaveBeenCalledWith('u1', 's1');
  });

  it('logout: when no session is resolved, does not revoke', async () => {
    const { service, tokens, sessions } = makeSut();
    tokens.verifyAccess.mockRejectedValue(new InvalidAccessTokenError());
    tokens.findByRaw.mockResolvedValue(null);

    await expect(service.logout({ accessToken: 'x' })).resolves.toBeUndefined();
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  it('logout: when session is resolved, revokes using logout reason', async () => {
    const { service, tokens, sessions } = makeSut();
    tokens.verifyAccess.mockResolvedValue({ sid: 'sess-1' });

    await expect(service.logout({ accessToken: 'x' })).resolves.toBeUndefined();
    expect(sessions.revoke).toHaveBeenCalledWith('sess-1', REVOKE_REASON.logout, expect.anything());
    expect(tokens.revokeSessionTokens).toHaveBeenCalledWith('sess-1', expect.anything());
  });
});
