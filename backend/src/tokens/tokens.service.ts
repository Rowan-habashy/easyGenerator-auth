import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { ClientSession, Types } from 'mongoose';
import { InvalidAccessTokenError } from '../common/errors/auth-errors';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { RefreshTokensRepository } from './refresh-tokens.repository';

export interface AccessPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly repo: RefreshTokensRepository,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  signAccess(userId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId, sid: sessionId } satisfies AccessPayload);
  }

  async verifyAccess(token: string): Promise<AccessPayload> {
    try {
      const p = await this.jwt.verifyAsync<AccessPayload>(token);
      if (!p.sub || !p.sid) throw new Error('bad payload');
      return p;
    } catch {
      throw new InvalidAccessTokenError();
    }
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Creates a refresh token record (hash only). Returns the raw token to send once. */
  async createRefresh(
    sessionId: string,
    session?: ClientSession,
    id?: Types.ObjectId,
  ): Promise<{ raw: string; id: Types.ObjectId }> {
    const raw = randomBytes(this.cfg.auth.refreshTokenBytes).toString('base64url');
    const doc = await this.repo.create(
      {
        _id: id,
        sessionId,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + this.cfg.auth.refreshTtlMs),
      },
      session,
    );
    return { raw, id: doc._id };
  }

  findByRaw(raw: string) {
    return this.repo.findByHash(this.hash(raw));
  }

  findById(id: Types.ObjectId) {
    return this.repo.findById(id);
  }

  consume(id: Types.ObjectId, replacedBy: Types.ObjectId, session: ClientSession) {
    return this.repo.consume(id, replacedBy, session);
  }

  revokeSessionTokens(sessionId: string, session?: ClientSession) {
    return this.repo.revokeActiveBySession(sessionId, session);
  }
}
