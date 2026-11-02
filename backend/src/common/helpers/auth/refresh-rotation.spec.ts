import { Types } from 'mongoose';
import {
  InvalidRefreshTokenError,
  RefreshConflictError,
  ServiceUnavailableError,
} from '../../errors/auth-errors';
import { LABEL_TRANSIENT_TX } from '../../../database/mongo.constants';
import { makeConfig } from '../../../test/test-helpers';
import { REVOKE_REASON } from '../../../auth/auth.constants';
import { RefreshRotation } from './refresh-rotation';

describe('RefreshRotation', () => {
  const makeSut = () => {
    const cfg = makeConfig();

    const users = {
      findById: jest.fn(),
    };

    const sessions = {
      findById: jest.fn(),
      isActive: jest.fn(),
      touch: jest.fn(),
      revoke: jest.fn(),
    };

    const tokens = {
      findByRaw: jest.fn(),
      consume: jest.fn(),
      createRefresh: jest.fn(),
      findById: jest.fn(),
      revokeSessionTokens: jest.fn(),
    };

    const transactions = {
      runManual: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({ id: 'tx-1' })),
      run: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({ id: 'tx-2' })),
    };

    const classifier = {
      isWriteConflict: jest.fn(() => false),
      hasLabel: jest.fn(() => false),
    };

    const rotation = new RefreshRotation(
      cfg,
      users as never,
      sessions as never,
      tokens as never,
      transactions as never,
      classifier as never,
    );

    return { cfg, users, sessions, tokens, transactions, classifier, rotation };
  };

  it('rotates active refresh token and returns new token with session/user ids', async () => {
    const { rotation, users, sessions, tokens } = makeSut();

    const r1Id = new Types.ObjectId();
    const sessionId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId().toString();

    tokens.findByRaw.mockResolvedValue({
      _id: r1Id,
      sessionId,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.findById.mockResolvedValue({
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.isActive.mockReturnValue(true);
    users.findById.mockResolvedValue({
      id: userId,
      isDisabled: false,
    });
    tokens.consume.mockResolvedValue(true);
    tokens.createRefresh.mockResolvedValue({ raw: 'r2' });

    await expect(rotation.rotate('r1')).resolves.toEqual({
      refreshToken: 'r2',
      sessionId,
      userId,
    });

    expect(tokens.consume).toHaveBeenCalledWith(r1Id, expect.any(Types.ObjectId), expect.anything());
    expect(tokens.createRefresh).toHaveBeenCalledWith(sessionId, expect.anything(), expect.any(Types.ObjectId));
    expect(sessions.touch).toHaveBeenCalledWith(sessionId, expect.anything());
  });

  it('throws InvalidRefreshTokenError when refresh token is unknown', async () => {
    const { rotation, tokens } = makeSut();
    tokens.findByRaw.mockResolvedValue(null);

    await expect(rotation.rotate('missing')).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when session is not active', async () => {
    const { rotation, users, sessions, tokens } = makeSut();

    const r1Id = new Types.ObjectId();
    tokens.findByRaw.mockResolvedValue({
      _id: r1Id,
      sessionId: new Types.ObjectId(),
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.findById.mockResolvedValue({ id: 's1', userId: 'u1' });
    sessions.isActive.mockReturnValue(false);
    users.findById.mockResolvedValue({ id: 'u1', isDisabled: false });

    await expect(rotation.rotate('r1')).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws RefreshConflictError when token was already used within grace window', async () => {
  const { cfg, rotation, users, sessions, tokens } = makeSut();

    const now = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    tokens.findByRaw.mockResolvedValue({
      _id: new Types.ObjectId(),
      sessionId: new Types.ObjectId(),
      usedAt: new Date(now - Math.floor(cfg.auth.refreshGraceMs / 2)),
      revokedAt: null,
      expiresAt: new Date(now + 60_000),
    });
    sessions.findById.mockResolvedValue({
      id: 'sess-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(now + 60_000),
    });
    sessions.isActive.mockReturnValue(true);
    users.findById.mockResolvedValue({ id: 'user-1', isDisabled: false });

    await expect(rotation.rotate('r1')).rejects.toBeInstanceOf(RefreshConflictError);
  expect(sessions.revoke).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('revokes session for replay and throws InvalidRefreshTokenError when reuse is outside grace window', async () => {
  const { cfg, rotation, users, sessions, tokens } = makeSut();

    const now = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    tokens.findByRaw.mockResolvedValue({
      _id: new Types.ObjectId(),
      sessionId: new Types.ObjectId(),
      usedAt: new Date(now - cfg.auth.refreshGraceMs - 1),
      revokedAt: null,
      expiresAt: new Date(now + 60_000),
    });
    sessions.findById.mockResolvedValue({
      id: 'sess-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(now + 60_000),
    });
    sessions.isActive.mockReturnValue(true);
    users.findById.mockResolvedValue({ id: 'user-1', isDisabled: false });

    await expect(rotation.rotate('r1')).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  expect(sessions.revoke).toHaveBeenCalledWith('sess-1', REVOKE_REASON.replay, expect.anything());
  expect(tokens.revokeSessionTokens).toHaveBeenCalledWith('sess-1', expect.anything());

    nowSpy.mockRestore();
  });

  it('maps lost race to RefreshConflictError when current token is now used', async () => {
    const { rotation, users, sessions, tokens, transactions } = makeSut();

    const r1Id = new Types.ObjectId();
    const sessionId = 'sess-1';
    const userId = 'user-1';

    tokens.findByRaw.mockResolvedValue({
      _id: r1Id,
      sessionId,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.findById.mockResolvedValue({
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.isActive.mockReturnValue(true);
    users.findById.mockResolvedValue({ id: userId, isDisabled: false });

    transactions.runManual.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work({ id: 'tx-1' }));
    tokens.consume.mockResolvedValue(false);
    tokens.findById.mockResolvedValue({
      _id: r1Id,
      usedAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(rotation.rotate('r1')).rejects.toBeInstanceOf(RefreshConflictError);
    expect(tokens.findById).toHaveBeenCalledWith(r1Id);
  });

  it('maps transient transaction label to InvalidRefreshTokenError when token is no longer active', async () => {
    const { rotation, users, sessions, tokens, transactions, classifier } = makeSut();

    const r1Id = new Types.ObjectId();
    const sessionId = 'sess-1';
    const userId = 'user-1';

    tokens.findByRaw.mockResolvedValue({
      _id: r1Id,
      sessionId,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.findById.mockResolvedValue({
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.isActive.mockReturnValue(true);
    users.findById.mockResolvedValue({ id: userId, isDisabled: false });

    const transientError = Object.assign(new Error('transient'), {
      hasErrorLabel: (label: string) => label === LABEL_TRANSIENT_TX,
    });

    transactions.runManual.mockRejectedValue(transientError);
    classifier.hasLabel.mockReturnValue(true);
    tokens.findById.mockResolvedValue({
      _id: r1Id,
      usedAt: null,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(rotation.rotate('r1')).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws ServiceUnavailableError when rotation failure is not a lost-race case', async () => {
    const { rotation, users, sessions, tokens, transactions, classifier } = makeSut();

    const r1Id = new Types.ObjectId();
    const sessionId = 'sess-1';
    const userId = 'user-1';

    tokens.findByRaw.mockResolvedValue({
      _id: r1Id,
      sessionId,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.findById.mockResolvedValue({
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessions.isActive.mockReturnValue(true);
    users.findById.mockResolvedValue({ id: userId, isDisabled: false });

    transactions.runManual.mockRejectedValue(new Error('db down'));
    classifier.isWriteConflict.mockReturnValue(false);
    classifier.hasLabel.mockReturnValue(false);

    await expect(rotation.rotate('r1')).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(tokens.findById).not.toHaveBeenCalled();
  });
});
