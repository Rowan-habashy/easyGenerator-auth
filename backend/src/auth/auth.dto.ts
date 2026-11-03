import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { VALIDATION } from './auth.constants';

export const normalizeEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : v);

export class PublicUserDto {
  @ApiProperty({ example: '665f7ae8d2fdd3fadc5f9d61' })
  id: string;

  @ApiProperty({ example: 'rowan@example.com' })
  email: string;

  @ApiProperty({ example: 'Rowan Habashy' })
  name: string;

  @ApiProperty({ example: '2026-11-02T20:01:20.000Z' })
  createdAt: Date;
}

export class AuthSessionResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ type: PublicUserDto })
  user: PublicUserDto;
}

export class AccessTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;
}

export class SignUpDto {
  @ApiProperty({ example: 'rowan@example.com', maxLength: VALIDATION.emailMax })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(VALIDATION.emailMax)
  email: string;

  @ApiProperty({ example: 'Rowan Habashy', minLength: VALIDATION.nameMin, maxLength: VALIDATION.nameMax })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(VALIDATION.nameMin)
  @MaxLength(VALIDATION.nameMax)
  name: string;

  @ApiProperty({ example: 'Password123!', minLength: VALIDATION.passwordMin, maxLength: VALIDATION.passwordMax })
  @IsString()
  @MinLength(VALIDATION.passwordMin)
  @MaxLength(VALIDATION.passwordMax)
  @Matches(/[A-Za-z]/, { message: 'password must contain at least one letter' })
  @Matches(/[0-9]/, { message: 'password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'password must contain at least one special character' })
  password: string;
}

export class SignInDto {
  @ApiProperty({ example: 'rowan@example.com', maxLength: VALIDATION.emailMax })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(VALIDATION.emailMax)
  email: string;

  @ApiProperty({ example: 'Password123!', minLength: 1, maxLength: VALIDATION.passwordMax })
  @IsString()
  @MinLength(1)
  @MaxLength(VALIDATION.passwordMax)
  password: string;
}
