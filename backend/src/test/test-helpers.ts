import { Types } from 'mongoose';
import { AppConfig } from '../config/app-config';

const DAY_MS = 24 * 60 * 60 * 1000;

export const makeConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  port: 3000,
  frontendOrigin: 'https://app.example.com',
  mongoUri: 'mongodb://localhost/test',
  rateLimitStore: 'memory',
  redisUrl: '',
  trustProxyHops: 1,
  jwt: { secret: 'test-secret-test-secret-test-secret', expiresIn: '15m', algorithm: 'HS256' },
  cookie: { name: 'refresh_token', path: '/api/auth', secure: true, sameSite: 'strict' },
  hsts: { maxAgeSeconds: 31536000 },
  auth: {
    sessionTtlMs: 30 * DAY_MS,
    refreshTtlMs: 7 * DAY_MS,
    refreshGraceMs: 10_000,
    refreshTokenBytes: 48,
    bcryptRounds: 4,
    maxTxAttempts: 3,
    maxCommitRetries: 3,
    purgeAfterSeconds: 7 * 24 * 60 * 60,
  },
  throttle: { ttlMs: 60_000, limit: 100 },
  signin: { maxPerIp: 5, maxPerEmail: 10, windowSeconds: 900, maxMemoryKeys: 100 },
  ...overrides,
});

/** A Mongo driver style error: name, optional code, optional error labels. */
export const mongoError = (opts: { name?: string; code?: number; labels?: string[] } = {}) =>
  Object.assign(new Error('mongo error'), {
    name: opts.name ?? 'MongoServerError',
    code: opts.code,
    hasErrorLabel: (label: string) => (opts.labels ?? []).includes(label),
  });

/** Fake ClientSession. withTransaction re-runs the callback on TransientTransactionError, like the driver. */
export const makeMongoSession = () => {
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(async () => undefined),
    abortTransaction: jest.fn(async () => undefined),
    endSession: jest.fn(async () => undefined),
    inTransaction: jest.fn(() => true),
    withTransaction: jest.fn(async (fn: () => Promise<unknown>) => {
      for (;;) {
        try {
          return await fn();
        } catch (e) {
          if ((e as { hasErrorLabel?: (l: string) => boolean }).hasErrorLabel?.('TransientTransactionError')) continue;
          throw e;
        }
      }
    }),
  };
  return session;
};

export const makeConnection = (session = makeMongoSession()) => ({
  session,
  startSession: jest.fn(async () => session),
});


export class FakeUsersRepository {
  users: any[] = [];

  findByEmail = jest.fn(async (email: string) => this.users.find((u) => u.email === email) ?? null);
  findById = jest.fn(async (id: string) => this.users.find((u) => u.id === id) ?? null);
  create = jest.fn(async (data: { email: string; name: string; passwordHash: string }, _session?: unknown) => {
    const _id = new Types.ObjectId();
    const user = { _id, id: _id.toString(), isDisabled: false, createdAt: new Date(), updatedAt: new Date(), ...data };
    this.users.push(user);
    return user;
  });

  seed(data: { email: string; name?: string; passwordHash: string; isDisabled?: boolean }) {
    const _id = new Types.ObjectId();
    const user = { _id, id: _id.toString(), name: 'Rowan', isDisabled: false, createdAt: new Date(), updatedAt: new Date(), ...data };
    this.users.push(user);
    return user;
  }
}

export class FakeSessionsRepository {
  sessions: any[] = [];

  create = jest.fn(async (userId: string, expiresAt: Date, _session?: unknown) => {
    const _id = new Types.ObjectId();
    const session = { _id, id: _id.toString(), userId: new Types.ObjectId(userId), expiresAt, revokedAt: null, revokedReason: null, lastUsedAt: new Date() };
    this.sessions.push(session);
    return session;
  });
  findById = jest.fn(async (id: string) => this.sessions.find((s) => s.id === id) ?? null);
  revoke = jest.fn(async (id: string, reason: string, _session?: unknown) => {
    const s = this.sessions.find((x) => x.id === id);
    if (s && !s.revokedAt) {
      s.revokedAt = new Date();
      s.revokedReason = reason;
    }
  });
  touch = jest.fn(async (id: string, _session?: unknown) => {
    const s = this.sessions.find((x) => x.id === id);
    if (s) s.lastUsedAt = new Date();
  });
}

export class FakeRefreshTokensRepository {
  docs: any[] = [];

  create = jest.fn(async (data: { _id?: Types.ObjectId; sessionId: string; tokenHash: string; expiresAt: Date }, _session?: unknown) => {
    const doc = {
      _id: data._id ?? new Types.ObjectId(),
      sessionId: new Types.ObjectId(data.sessionId),
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      usedAt: null as Date | null,
      revokedAt: null as Date | null,
      replacedBy: null as Types.ObjectId | null,
    };
    this.docs.push(doc);
    return doc;
  });
  findByHash = jest.fn(async (hash: string) => this.docs.find((d) => d.tokenHash === hash) ?? null);
  findById = jest.fn(async (id: Types.ObjectId) => this.docs.find((d) => d._id.equals(id)) ?? null);
  consume = jest.fn(async (id: Types.ObjectId, replacedBy: Types.ObjectId, _session?: unknown) => {
    const d = this.docs.find((x) => x._id.equals(id));
    if (!d || d.usedAt || d.revokedAt) return false;
    d.usedAt = new Date();
    d.replacedBy = replacedBy;
    return true;
  });
  revokeActiveBySession = jest.fn(async (sessionId: string, _session?: unknown) => {
    for (const d of this.docs) if (d.sessionId.toString() === sessionId && !d.revokedAt) d.revokedAt = new Date();
  });
}
