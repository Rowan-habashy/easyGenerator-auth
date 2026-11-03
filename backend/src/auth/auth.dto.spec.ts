import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SignInDto, SignUpDto, normalizeEmail } from './auth.dto';

describe('Auth DTOs', () => {
  it('normalizeEmail trims and lowercases', () => {
    expect(normalizeEmail('  Rowan@Example.COM ')).toBe('rowan@example.com');
    expect(normalizeEmail(10)).toBe(10);
  });

  it('SignUpDto transforms email/name and validates a valid payload', () => {
    const dto = plainToInstance(SignUpDto, {
      email: '  ROWAN@EXAMPLE.COM ',
      name: '  Rowan  ',
      password: 'Password123!',
    });

    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('rowan@example.com');
    expect(dto.name).toBe('Rowan');
  });

  it('SignUpDto rejects invalid email and short password', () => {
    const dto = plainToInstance(SignUpDto, {
      email: 'bad-email',
      name: 'Ro',
      password: 'short',
    });

    const errors = validateSync(dto);
    const fields = errors.map((e) => e.property);
    expect(fields).toContain('email');
    expect(fields).toContain('name');
    expect(fields).toContain('password');
  });

  it('SignUpDto rejects password missing complexity requirements', () => {
    const dto = plainToInstance(SignUpDto, {
      email: 'rowan@example.com',
      name: 'Rowan',
      password: 'abcdefgh',
    });

    const errors = validateSync(dto);
    const passwordError = errors.find((error) => error.property === 'password');
    expect(passwordError).toBeDefined();
  });

  it('SignInDto rejects empty password and too long email', () => {
    const dto = plainToInstance(SignInDto, {
      email: `${'a'.repeat(255)}@x.com`,
      password: '',
    });

    const errors = validateSync(dto);
    const fields = errors.map((e) => e.property);
    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });
});
