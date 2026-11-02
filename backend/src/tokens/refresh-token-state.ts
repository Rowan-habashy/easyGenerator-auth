import { RefreshTokenDocument } from './refresh-token.schema';

type TokenDates = Pick<RefreshTokenDocument, 'revokedAt' | 'expiresAt'>;

export const isRefreshTokenActive = (token: TokenDates): boolean =>
  !token.revokedAt && token.expiresAt.getTime() > Date.now();

export const wasUsedWithin = (token: Pick<RefreshTokenDocument, 'usedAt'>, windowMs: number): boolean =>
  !!token.usedAt && Date.now() - token.usedAt.getTime() <= windowMs;
