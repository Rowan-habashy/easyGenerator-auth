import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { VALIDATION } from './auth.constants';

export const normalizeEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : v);

export class SignUpDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(VALIDATION.emailMax)
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(VALIDATION.nameMin)
  @MaxLength(VALIDATION.nameMax)
  name: string;

  @IsString()
  @MinLength(VALIDATION.passwordMin)
  @MaxLength(VALIDATION.passwordMax)
  password: string;
}

export class SignInDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(VALIDATION.emailMax)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(VALIDATION.passwordMax)
  password: string;
}
