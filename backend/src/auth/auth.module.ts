import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { TokensModule } from '../tokens/tokens.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FailedSigninLimiter } from './failed-signin-limiter';
import { PasswordHasher } from './password-hasher';

@Module({
  imports: [UsersModule, SessionsModule, TokensModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, FailedSigninLimiter],
})
export class AuthModule {}
