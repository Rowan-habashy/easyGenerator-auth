import { makeConfig } from '../test/test-helpers';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  const cfg = makeConfig();

  const makeSut = () => {
    const repo = {
      create: jest.fn(),
      findById: jest.fn(),
      revoke: jest.fn(),
      touch: jest.fn(),
    };
    const service = new SessionsService(repo as never, cfg);
    return { service, repo };
  };

  it('create delegates to repo with computed expiresAt', async () => {
    const { service, repo } = makeSut();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    repo.create.mockResolvedValue({ id: 's1' });

    await service.create('u1');

    expect(repo.create).toHaveBeenCalledWith('u1', new Date(1_000 + cfg.auth.sessionTtlMs), undefined);
    nowSpy.mockRestore();
  });

  it('isActive checks revoked and expiry', () => {
    const { service } = makeSut();
    expect(service.isActive(null)).toBe(false);
    expect(service.isActive({ revokedAt: new Date(), expiresAt: new Date(Date.now() + 1000) } as never)).toBe(false);
    expect(service.isActive({ revokedAt: null, expiresAt: new Date(Date.now() - 1) } as never)).toBe(false);
    expect(service.isActive({ revokedAt: null, expiresAt: new Date(Date.now() + 1000) } as never)).toBe(true);
  });

  it('findActive returns only active sessions', async () => {
    const { service, repo } = makeSut();
    repo.findById.mockResolvedValueOnce({ revokedAt: null, expiresAt: new Date(Date.now() + 1000) });
    repo.findById.mockResolvedValueOnce({ revokedAt: null, expiresAt: new Date(Date.now() - 1000) });

    await expect(service.findActive('s1')).resolves.toBeTruthy();
    await expect(service.findActive('s2')).resolves.toBeNull();
  });

  it('revoke/touch delegate to repo', async () => {
    const { service, repo } = makeSut();
    await service.revoke('s1', 'logout');
    await service.touch('s1');

    expect(repo.revoke).toHaveBeenCalledWith('s1', 'logout', undefined);
    expect(repo.touch).toHaveBeenCalledWith('s1', undefined);
  });
});
