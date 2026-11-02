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
      password: 'Password123',
    });

    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('rowan@example.com');
    expect(dto.name).toBe('Rowan');
  });

  it('SignUpDto rejects invalid email and short password', () => {
    const dto = plainToInstance(SignUpDto, {
      email: 'bad-email',
      name: 'R',
      password: 'short',
    });

    const errors = validateSync(dto);
    const fields = errors.map((e) => e.property);
    expect(fields).toContain('email');
    expect(fields).toContain('password');
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
