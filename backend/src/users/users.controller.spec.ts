import { InvalidAccessTokenError } from '../common/errors/auth-errors';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  const makeSut = () => {
    const users = { findById: jest.fn() };
    const controller = new UsersController(users as never);
    return { controller, users };
  };

  it('me returns public profile for authenticated user', async () => {
    const { controller, users } = makeSut();
    users.findById.mockResolvedValue({
      id: 'u1',
      email: 'rowan@example.com',
      name: 'Rowan',
      createdAt: new Date('2026-01-01'),
      passwordHash: 'hidden',
    });

    await expect(controller.me({ auth: { userId: 'u1' } } as any)).resolves.toEqual({
      id: 'u1',
      email: 'rowan@example.com',
      name: 'Rowan',
      createdAt: new Date('2026-01-01'),
    });
  });

  it('me throws InvalidAccessTokenError when user does not exist', async () => {
    const { controller, users } = makeSut();
    users.findById.mockResolvedValue(null);
    await expect(controller.me({ auth: { userId: 'missing' } } as any)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
