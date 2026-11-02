import { Types } from 'mongoose';
import { InvalidAccessTokenError } from '../common/errors/auth-errors';
import { makeConfig } from '../test/test-helpers';
import { TokensService } from './tokens.service';

describe('TokensService', () => {
  const cfg = makeConfig();

  const makeSut = () => {
    const jwt = {
      signAsync: jest.fn(async () => 'access-token'),
      verifyAsync: jest.fn(async () => ({ sub: 'u1', sid: 's1' })),
    };
    const repo = {
      create: jest.fn(async (data: any) => ({ _id: data._id ?? new Types.ObjectId() })),
      findByHash: jest.fn(),
      findById: jest.fn(),
      consume: jest.fn(),
      revokeActiveBySession: jest.fn(),
    };
    const service = new TokensService(jwt as never, repo as never, cfg);
    return { service, jwt, repo };
  };

  it('signAccess delegates to jwt signAsync', async () => {
    const { service, jwt } = makeSut();
    await expect(service.signAccess('u1', 's1')).resolves.toBe('access-token');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', sid: 's1' });
  });

  it('verifyAccess returns payload and rejects invalid payload/token', async () => {
    const { service, jwt } = makeSut();
    await expect(service.verifyAccess('ok')).resolves.toEqual({ sub: 'u1', sid: 's1' });

  jwt.verifyAsync.mockResolvedValueOnce({ sub: 'u1' } as any);
    await expect(service.verifyAccess('bad-payload')).rejects.toBeInstanceOf(InvalidAccessTokenError);

    jwt.verifyAsync.mockRejectedValueOnce(new Error('jwt fail'));
    await expect(service.verifyAccess('bad')).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('hash is deterministic sha256', () => {
    const { service } = makeSut();
    expect(service.hash('abc')).toBe(service.hash('abc'));
    expect(service.hash('abc')).not.toBe(service.hash('abcd'));
  });

  it('createRefresh creates record with hashed token and returns raw/id', async () => {
    const { service, repo } = makeSut();
    const id = new Types.ObjectId();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);

    const result = await service.createRefresh('sess-1', undefined, id);

    expect(result.id.equals(id)).toBe(true);
    expect(result.raw).toEqual(expect.any(String));
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: id,
        sessionId: 'sess-1',
        tokenHash: service.hash(result.raw),
        expiresAt: new Date(1000 + cfg.auth.refreshTtlMs),
      }),
      undefined,
    );
    nowSpy.mockRestore();
  });

  it('find/consume/revoke methods delegate to repository', async () => {
    const { service, repo } = makeSut();
    const id = new Types.ObjectId();
    const repl = new Types.ObjectId();
    const session: any = { id: 'tx' };

    await service.findByRaw('r1');
    await service.findById(id);
    await service.consume(id, repl, session);
    await service.revokeSessionTokens('s1');

    expect(repo.findByHash).toHaveBeenCalledWith(service.hash('r1'));
    expect(repo.findById).toHaveBeenCalledWith(id);
    expect(repo.consume).toHaveBeenCalledWith(id, repl, session);
    expect(repo.revokeActiveBySession).toHaveBeenCalledWith('s1', undefined);
  });
});
