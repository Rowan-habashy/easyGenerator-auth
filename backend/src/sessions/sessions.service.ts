import { Inject, Injectable } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { SessionDocument } from './session.schema';
import { SessionsRepository } from './sessions.repository';

@Injectable()
export class SessionsService {
  constructor(
    private readonly repo: SessionsRepository,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  create(userId: string, session?: ClientSession) {
    return this.repo.create(userId, new Date(Date.now() + this.cfg.auth.sessionTtlMs), session);
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  isActive(s: SessionDocument | null): s is SessionDocument {
    return !!s && !s.revokedAt && s.expiresAt.getTime() > Date.now();
  }

  async findActive(id: string): Promise<SessionDocument | null> {
    const s = await this.repo.findById(id);
    return this.isActive(s) ? s : null;
  }

  revoke(id: string, reason: string, session?: ClientSession) {
    return this.repo.revoke(id, reason, session);
  }

  touch(id: string, session?: ClientSession) {
    return this.repo.touch(id, session);
  }
}
