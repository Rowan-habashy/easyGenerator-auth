import { AuthError, EmailTakenError, ServiceUnavailableError } from '../common/errors/auth-errors';
import { MONGO_DUPLICATE_KEY, MONGO_WRITE_CONFLICT } from './mongo.constants';
import { MongoErrorClassifier } from './mongo-error-classifier';

describe('MongoErrorClassifier', () => {
  const c = new MongoErrorClassifier();

  it('detects labels and known mongo codes', () => {
    const e: any = { hasErrorLabel: (label: string) => label === 'x', code: MONGO_DUPLICATE_KEY, name: 'MongoServerError' };
    expect(c.hasLabel(e, 'x')).toBe(true);
    expect(c.isDuplicateKey(e)).toBe(true);
    expect(c.isMongoError(e)).toBe(true);

    const w: any = { code: MONGO_WRITE_CONFLICT };
    expect(c.isWriteConflict(w)).toBe(true);
  });

  it('classify passes through AuthError and maps duplicate/service unavailable', () => {
    const authErr = new AuthError(418, 'TEA', 'teapot');
    expect(c.classify(authErr)).toBe(authErr);
    expect(c.classify({ code: MONGO_DUPLICATE_KEY })).toBeInstanceOf(EmailTakenError);
    expect(c.classify(new Error('x'))).toBeInstanceOf(ServiceUnavailableError);
  });
});
