import { Inject, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  AuthError,
  InvalidRefreshTokenError,
  RefreshConflictError,
  ServiceUnavailableError,
} from '../../errors/auth-errors';
import { APP_CONFIG, AppConfig } from '../../../config/app-config';
import { LABEL_TRANSIENT_TX } from '../../../database/mongo.constants';
import { MongoErrorClassifier } from '../../../database/mongo-error-classifier';
import { TransactionRunner } from '../../../database/transaction-runner';
import { SessionsService } from '../../../sessions/sessions.service';
import { isRefreshTokenActive, wasUsedWithin } from '../../../tokens/refresh-token-state';
import { TokensService } from '../../../tokens/tokens.service';
import { UsersService } from '../../../users/users.service';
import { REVOKE_REASON } from '../../../auth/auth.constants';

export interface RotationResult {
  refreshToken: string;
  sessionId: string;
  userId: string;
}

class RotationLostRace extends Error {}

@Injectable()
export class RefreshRotation {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
    private readonly transactions: TransactionRunner,
    private readonly classifier: MongoErrorClassifier,
  ) {}

  async rotate(rawToken: string): Promise<RotationResult> {
    const { r1Id, sessionId, userId } = await this.validate(rawToken);
    const refreshToken = await this.swap(r1Id, sessionId);
    return { refreshToken, sessionId, userId };
  }

  private async validate(rawToken: string) {
    const r1 = await this.tokens.findByRaw(rawToken);
    if (!r1 || !isRefreshTokenActive(r1)) throw new InvalidRefreshTokenError();

    const session = await this.sessions.findById(r1.sessionId.toString());
    if (!this.sessions.isActive(session)) throw new InvalidRefreshTokenError();

    const user = await this.users.findById(session.userId.toString());
    if (!user || user.isDisabled) throw new InvalidRefreshTokenError();

    if (r1.usedAt) {
      if (wasUsedWithin(r1, this.cfg.auth.refreshGraceMs)) throw new RefreshConflictError();
      await this.revokeSession(session.id, REVOKE_REASON.replay);
      throw new InvalidRefreshTokenError();
    }
    return { r1Id: r1._id, sessionId: session.id as string, userId: user.id as string };
  }

  private revokeSession(sessionId: string, reason: string): Promise<void> {
    return this.transactions.run(async (transaction) => {
      await this.sessions.revoke(sessionId, reason, transaction);
      await this.tokens.revokeSessionTokens(sessionId, transaction);
    });
  }

  private async swap(r1Id: Types.ObjectId, sessionId: string): Promise<string> {
    const r2Id = new Types.ObjectId();
    try {
      return await this.transactions.runManual(async (transaction) => {
        if (!(await this.tokens.consume(r1Id, r2Id, transaction))) throw new RotationLostRace();
        const r2 = await this.tokens.createRefresh(sessionId, transaction, r2Id);
        await this.sessions.touch(sessionId, transaction);
        return r2.raw;
      });
    } catch (error) {
      if (error instanceof AuthError) throw error;
      const lostRace =
        error instanceof RotationLostRace ||
        this.classifier.isWriteConflict(error) ||
        this.classifier.hasLabel(error, LABEL_TRANSIENT_TX);
      throw lostRace ? await this.classifyLostRace(r1Id) : new ServiceUnavailableError();
    }
  }

  private async classifyLostRace(r1Id: Types.ObjectId): Promise<AuthError> {
    try {
      const current = await this.tokens.findById(r1Id);
      if (!current || !isRefreshTokenActive(current)) return new InvalidRefreshTokenError();
      if (current.usedAt) return new RefreshConflictError();
      return new ServiceUnavailableError();
    } catch {
      return new ServiceUnavailableError();
    }
  }
}
