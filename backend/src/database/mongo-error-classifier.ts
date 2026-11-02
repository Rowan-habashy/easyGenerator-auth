import { Injectable } from '@nestjs/common';
import { AuthError, EmailTakenError, ServiceUnavailableError } from '../common/errors/auth-errors';
import { MONGO_DUPLICATE_KEY, MONGO_WRITE_CONFLICT } from './mongo.constants';

@Injectable()
export class MongoErrorClassifier {
  hasLabel(err: unknown, label: string): boolean {
    const e = err as { hasErrorLabel?: (l: string) => boolean };
    return typeof e?.hasErrorLabel === 'function' && e.hasErrorLabel(label);
  }

  isDuplicateKey(err: unknown): boolean {
    return (err as { code?: number })?.code === MONGO_DUPLICATE_KEY;
  }

  isWriteConflict(err: unknown): boolean {
    return (err as { code?: number })?.code === MONGO_WRITE_CONFLICT;
  }

  isMongoError(err: unknown): boolean {
    return /^Mongo/.test((err as { name?: string })?.name ?? '');
  }

  classify(err: unknown): AuthError {
    if (err instanceof AuthError) return err;
    if (this.isDuplicateKey(err)) return new EmailTakenError();
    return new ServiceUnavailableError();
  }
}
