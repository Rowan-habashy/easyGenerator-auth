import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';
import {
  AccountDisabledError,
  AuthError,
  EmailTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  OutcomeUncertainError,
  RefreshConflictError,
  ServiceUnavailableError,
} from '../common/errors/auth-errors';
import { MongoErrorClassifier } from '../database/mongo-error-classifier';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { SessionsService } from '../sessions/sessions.service';
import { RefreshTokenDocument } from '../tokens/refresh-token.schema';
import { TokensService } from '../tokens/tokens.service';
import { toPublicUser, PublicUser, UsersService } from '../users/users.service';
import { PasswordHasher } from './password-hasher';
import { Types } from 'mongoose';
import { LABEL_TRANSIENT_TX, LABEL_UNKNOWN_COMMIT } from '../database/mongo.constants';
import { REVOKE_REASON } from './auth.constants';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}


@Injectable()
export class AuthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
    private readonly hasher: PasswordHasher,
    private readonly classifier: MongoErrorClassifier,
  ) {}

  async signUp(email: string, name: string, password: string): Promise<AuthResult> {
    if (await this.users.findByEmail(email)) throw new EmailTakenError();
    const passwordHash = await this.hasher.hash(password);

    try {
      return await this.inTransaction(async (s) => {
        const user = await this.users.create({ email, name, passwordHash }, s);
        const sess = await this.sessions.create(user.id, s);
        const refresh = await this.tokens.createRefresh(sess.id, s);
        const accessToken = await this.tokens.signAccess(user.id, sess.id);
        return { accessToken, refreshToken: refresh.raw, user: toPublicUser(user) };
      });
    } catch (e) {
      throw this.classifier.classify(e);
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    let user;
    try {
      user = await this.users.findByEmail(email);
    } catch (e) {
      throw this.classifier.classify(e);
    }

    if (!user) {
      await this.hasher.compareDummy(password);
      throw new InvalidCredentialsError();
    }
    if (!(await this.hasher.compare(password, user.passwordHash))) throw new InvalidCredentialsError();
    if (user.isDisabled) throw new AccountDisabledError();

    try {
      return await this.inTransaction(async (s) => {
        const sess = await this.sessions.create(user.id, s);
        const refresh = await this.tokens.createRefresh(sess.id, s);
        const accessToken = await this.tokens.signAccess(user.id, sess.id);
        return { accessToken, refreshToken: refresh.raw, user: toPublicUser(user) };
      });
    } catch (e) {
      throw this.classifier.classify(e);
    }
  }

  async refresh(rawToken: string | undefined): Promise<{ accessToken: string; refreshToken: string }> {
    if (!rawToken) throw new InvalidRefreshTokenError();

    let r1: RefreshTokenDocument | null;
    let sessionDoc;
    let user;
    try {
      r1 = await this.tokens.findByRaw(rawToken);
      if (!r1 || r1.revokedAt || r1.expiresAt.getTime() <= Date.now()) {
        throw new InvalidRefreshTokenError();
      }
      sessionDoc = await this.sessions.findById(r1.sessionId.toString());
      if (!this.sessions.isActive(sessionDoc)) throw new InvalidRefreshTokenError();
      user = await this.users.findById(sessionDoc.userId.toString());
      if (!user || user.isDisabled) throw new InvalidRefreshTokenError();

      if (r1.usedAt) {
        if (Date.now() - r1.usedAt.getTime() <= this.cfg.auth.refreshGraceMs) throw new RefreshConflictError();
        await this.revokeSession(sessionDoc.id, REVOKE_REASON.replay);
        throw new InvalidRefreshTokenError();
      }
    } catch (e) {
      throw this.classifier.classify(e);
    }

    const r1Id = r1._id;
    const sessionId: string = sessionDoc.id;
    const userId: string = user.id;
    const r2Id = new Types.ObjectId();

    const s = await this.connection.startSession();
    let rawR2: string;
    try {
      s.startTransaction();
      try {
        const consumed = await this.tokens.consume(r1Id, r2Id, s);
        if (!consumed) {
          await this.safeAbort(s);
          throw await this.classifyLostRace(r1Id);
        }
        const r2 = await this.tokens.createRefresh(sessionId, s, r2Id);
        rawR2 = r2.raw;
        await this.sessions.touch(sessionId, s);
      } catch (e) {
        await this.safeAbort(s);
        if (e instanceof AuthError) throw e;
        if (this.classifier.isWriteConflict(e) || this.classifier.hasLabel(e, LABEL_TRANSIENT_TX)) {
          throw await this.classifyLostRace(r1Id, true);
        }
        throw new ServiceUnavailableError();
      }

      await this.commitWithRetry(s);
    } finally {
      await s.endSession();
    }

    const accessToken = await this.tokens.signAccess(userId, sessionId);
    return { accessToken, refreshToken: rawR2 };
  }

  async logout(opts: { accessToken?: string; refreshToken?: string }): Promise<void> {
    const sessionId = await this.resolveSessionId(opts);
    if (!sessionId) return;
    try {
      await this.inTransaction(async (s) => {
        await this.sessions.revoke(sessionId, REVOKE_REASON.logout, s);
        await this.tokens.revokeSessionTokens(sessionId, s);
      });
    } catch (e) {
      throw this.classifier.classify(e);
    }
  }

  // ---- helpers ----

  private async resolveSessionId(opts: { accessToken?: string; refreshToken?: string }) {
    if (opts.accessToken) {
      try {
        return (await this.tokens.verifyAccess(opts.accessToken)).sid;
      } catch {
        /* fall through to refresh cookie */
      }
    }
    if (opts.refreshToken) {
      try {
        const doc = await this.tokens.findByRaw(opts.refreshToken);
        return doc?.sessionId.toString();
      } catch (e) {
        throw this.classifier.classify(e);
      }
    }
    return undefined;
  }

  private async revokeSession(sessionId: string, reason: string) {
    await this.inTransaction(async (s) => {
      await this.sessions.revoke(sessionId, reason, s);
      await this.tokens.revokeSessionTokens(sessionId, s);
    });
  }

  /** After losing the conditional update: 409 if consumed, else classify current state. */
  private async classifyLostRace(r1Id: Types.ObjectId, transient = false): Promise<AuthError> {
    try {
      const cur = await this.tokens.findById(r1Id);
      if (!cur || cur.revokedAt || cur.expiresAt.getTime() <= Date.now()) return new InvalidRefreshTokenError();
      if (cur.usedAt) return new RefreshConflictError();
      return new ServiceUnavailableError();
    } catch {
      return new ServiceUnavailableError();
    }
  }

  private async commitWithRetry(s: ClientSession): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await s.commitTransaction();
        return;
      } catch (e) {
        if (this.classifier.hasLabel(e, LABEL_UNKNOWN_COMMIT)) {
          if (attempt >= this.cfg.auth.maxCommitRetries) throw new OutcomeUncertainError();
          continue; // retry commit only
        }
        await this.safeAbort(s);
        throw new ServiceUnavailableError();
      }
    }
  }

  private async safeAbort(s: ClientSession) {
    try {
      if (s.inTransaction()) await s.abortTransaction();
    } catch {
      /* ignore */
    }
  }

  /** One transaction per flow; withTransaction retries transient errors (bounded by driver timeout). */
  private async inTransaction<T>(fn: (s: ClientSession) => Promise<T>): Promise<T> {
    const s = await this.connection.startSession();
    try {
      let result!: T;
      let attempts = 0;
      await s.withTransaction(async () => {
        // withTransaction re-runs this callback on TransientTransactionError; bound it
        if (++attempts > this.cfg.auth.maxTxAttempts) throw new ServiceUnavailableError();
        result = await fn(s);
      });
      return result;
    } finally {
      await s.endSession();
    }
  }
}
