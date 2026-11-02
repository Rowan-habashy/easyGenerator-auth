import { toPublicUser, UsersService } from './users.service';

describe('UsersService', () => {
  const makeSut = () => {
    const repo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    const service = new UsersService(repo as never);
    return { service, repo };
  };

  it('delegates CRUD-style methods to repository', async () => {
    const { service, repo } = makeSut();
    await service.findByEmail('a@b.com');
    await service.findById('u1');
    await service.create({ email: 'a@b.com', name: 'A', passwordHash: 'h' });

    expect(repo.findByEmail).toHaveBeenCalledWith('a@b.com');
    expect(repo.findById).toHaveBeenCalledWith('u1');
    expect(repo.create).toHaveBeenCalledWith({ email: 'a@b.com', name: 'A', passwordHash: 'h' }, undefined);
  });

  it('toPublicUser strips private fields', () => {
    const pub = toPublicUser({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      createdAt: new Date('2026-01-01'),
      passwordHash: 'secret',
    } as never);

    expect(pub).toEqual({ id: 'u1', email: 'a@b.com', name: 'A', createdAt: new Date('2026-01-01') });
    expect((pub as any).passwordHash).toBeUndefined();
  });
});
