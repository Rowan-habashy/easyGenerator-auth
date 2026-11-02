import { Injectable, Logger } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import {
  AccountDisabledError,
  EmailTakenError,
  InvalidCredentialsError,
  InvalidAccessTokenError,
  InvalidRefreshTokenError,
} from '../common/errors/auth-errors';
import { TransactionRunner } from '../database/transaction-runner';
import { SessionsService } from '../sessions/sessions.service';
import { TokensService } from '../tokens/tokens.service';
import { UserDocument } from '../users/user.schema';
import { toPublicUser } from '../users/users.service';
import { UsersService } from '../users/users.service';
import { REVOKE_REASON } from './auth.constants';
import { AuthResult, LogoutCredentials } from './auth.interface';
import { PasswordHasher } from '../common/helpers/auth/password-hasher';
import { RefreshRotation } from '../common/helpers/auth/refresh-rotation';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
    private readonly hasher: PasswordHasher,
    private readonly transactions: TransactionRunner,
    private readonly rotation: RefreshRotation,
  ) {}

  async signUp(email: string, name: string, password: string): Promise<AuthResult> {
    if (await this.users.findByEmail(email)) throw new EmailTakenError();
    const passwordHash = await this.hasher.hash(password);

    return this.transactions.run(async (transaction) => {
      const user = await this.users.create({ email, name, passwordHash }, transaction);
      return this.openSession(user, transaction);
    });
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      await this.hasher.compareDummy(password); 
      throw new InvalidCredentialsError();
    }
    if (!(await this.hasher.compare(password, user.passwordHash))) throw new InvalidCredentialsError();
    if (user.isDisabled) throw new AccountDisabledError();

    return this.transactions.run((transaction) => this.openSession(user, transaction));
  }

  async refresh(rawToken: string | undefined): Promise<{ accessToken: string; refreshToken: string }> {
    if (!rawToken) throw new InvalidRefreshTokenError();

    const { refreshToken, sessionId, userId } = await this.rotation.rotate(rawToken);
    const accessToken = await this.tokens.signAccess(userId, sessionId);
    return { accessToken, refreshToken };
  }

  async logout(credentials: LogoutCredentials): Promise<void> {
    const sessionId = await this.resolveSessionId(credentials);
    if (sessionId) await this.revokeSession(sessionId, REVOKE_REASON.logout);
  }

  private async openSession(user: UserDocument, transaction: ClientSession): Promise<AuthResult> {
    const session = await this.sessions.create(user.id, transaction);
    const refresh = await this.tokens.createRefresh(session.id, transaction);
    const accessToken = await this.tokens.signAccess(user.id, session.id);
    return { accessToken, refreshToken: refresh.raw, user: toPublicUser(user) };
  }

  private revokeSession(sessionId: string, reason: string): Promise<void> {
    return this.transactions.run(async (transaction) => {
      await this.sessions.revoke(sessionId, reason, transaction);
      await this.tokens.revokeSessionTokens(sessionId, transaction);
    });
  }

  private async resolveSessionId(credentials: LogoutCredentials): Promise<string | undefined> {
    if (credentials.accessToken) {
      try {
        return (await this.tokens.verifyAccess(credentials.accessToken)).sid;
      } catch (error) {
        if (!(error instanceof InvalidAccessTokenError)) throw error;
        this.logger.debug(`logout access token ignored; falling back to refresh cookie: ${error.message}`);
      }
    }

    if (credentials.refreshToken) {
      return (await this.tokens.findByRaw(credentials.refreshToken))?.sessionId.toString();
    }

    return undefined;
  }
}
