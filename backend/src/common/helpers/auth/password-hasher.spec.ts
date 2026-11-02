import { makeConfig } from '../../../test/test-helpers';
import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  it('hash + compare succeeds for the same password and fails for a different one', async () => {
    const hasher = new PasswordHasher(makeConfig());
    const hash = await hasher.hash('Password123');

    await expect(hasher.compare('Password123', hash)).resolves.toBe(true);
    await expect(hasher.compare('wrong', hash)).resolves.toBe(false);
  });

  it('compareDummy resolves without throwing', async () => {
    const hasher = new PasswordHasher(makeConfig());
    await expect(hasher.compareDummy('anything')).resolves.toBeUndefined();
  });
});
