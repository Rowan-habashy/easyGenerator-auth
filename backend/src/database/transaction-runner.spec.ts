import { OutcomeUncertainError, ServiceUnavailableError } from '../common/errors/auth-errors';
import { makeConfig, makeConnection, makeMongoSession, mongoError } from '../test/test-helpers';
import { TransactionRunner } from './transaction-runner';

describe('TransactionRunner', () => {
  it('run: returns operation result and always ends the session', async () => {
    const cfg = makeConfig();
    const connection = makeConnection();
    const classifier = { classify: jest.fn((e) => e), hasLabel: jest.fn(() => false) };
    const runner = new TransactionRunner(connection as never, cfg, classifier as never);

    const result = await runner.run(async () => 'ok');

    expect(result).toBe('ok');
    expect(connection.session.withTransaction).toHaveBeenCalledTimes(1);
    expect(connection.session.endSession).toHaveBeenCalledTimes(1);
  });

  it('run: maps failures through MongoErrorClassifier', async () => {
    const cfg = makeConfig();
    const connection = makeConnection();
    const mapped = new ServiceUnavailableError();
    const classifier = { classify: jest.fn(() => mapped), hasLabel: jest.fn(() => false) };
    const runner = new TransactionRunner(connection as never, cfg, classifier as never);

    await expect(runner.run(async () => {
      throw new Error('boom');
    })).rejects.toBe(mapped);

    expect(classifier.classify).toHaveBeenCalled();
    expect(connection.session.endSession).toHaveBeenCalledTimes(1);
  });

  it('run: bounds transient retries with maxTxAttempts', async () => {
    const cfg = makeConfig({ auth: { ...makeConfig().auth, maxTxAttempts: 2 } });
    const connection = makeConnection();
    const classifier = { classify: jest.fn((e) => e), hasLabel: jest.fn(() => false) };
    const runner = new TransactionRunner(connection as never, cfg, classifier as never);
    const transient = mongoError({ labels: ['TransientTransactionError'] });

    await expect(runner.run(async () => {
      throw transient;
    })).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('runManual: commits and returns result on success', async () => {
    const cfg = makeConfig();
    const connection = makeConnection();
    const classifier = { classify: jest.fn((e) => e), hasLabel: jest.fn(() => false) };
    const runner = new TransactionRunner(connection as never, cfg, classifier as never);

    const result = await runner.runManual(async () => 'done');

    expect(result).toBe('done');
    expect(connection.session.startTransaction).toHaveBeenCalledTimes(1);
    expect(connection.session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(connection.session.abortTransaction).not.toHaveBeenCalled();
    expect(connection.session.endSession).toHaveBeenCalledTimes(1);
  });

  it('runManual: aborts and rethrows operation errors', async () => {
    const cfg = makeConfig();
    const session = makeMongoSession();
    const connection = makeConnection(session);
    const classifier = { classify: jest.fn((e) => e), hasLabel: jest.fn(() => false) };
    const runner = new TransactionRunner(connection as never, cfg, classifier as never);
    const error = new Error('operation failed');

    await expect(runner.runManual(async () => {
      throw error;
    })).rejects.toBe(error);

    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('runManual: retries only commit for UnknownTransactionCommitResult', async () => {
    const cfg = makeConfig();
    const session = makeMongoSession();
    session.commitTransaction
      .mockRejectedValueOnce(mongoError({ labels: ['UnknownTransactionCommitResult'] }))
      .mockResolvedValueOnce(undefined);

    const connection = makeConnection(session);
    const classifier = {
      classify: jest.fn((e) => e),
      hasLabel: jest.fn((e, label) => (e as { hasErrorLabel?: (l: string) => boolean }).hasErrorLabel?.(label) ?? false),
    };
    const runner = new TransactionRunner(connection as never, cfg, classifier as never);
    const operation = jest.fn(async () => 'ok');

    const result = await runner.runManual(operation);

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).toHaveBeenCalledTimes(2);
  });

  it('runManual: throws OutcomeUncertainError after bounded unknown commit retries', async () => {
    const base = makeConfig();
    const cfg = makeConfig({ auth: { ...base.auth, maxCommitRetries: 2 } });
    const session = makeMongoSession();
    session.commitTransaction.mockRejectedValue(mongoError({ labels: ['UnknownTransactionCommitResult'] }));

    const connection = makeConnection(session);
    const classifier = {
      classify: jest.fn((e) => e),
      hasLabel: jest.fn((e, label) => (e as { hasErrorLabel?: (l: string) => boolean }).hasErrorLabel?.(label) ?? false),
    };
    const runner = new TransactionRunner(connection as never, cfg, classifier as never);

    await expect(runner.runManual(async () => 'x')).rejects.toBeInstanceOf(OutcomeUncertainError);
    expect(session.commitTransaction).toHaveBeenCalledTimes(2);
  });

  it('runManual: aborts and throws ServiceUnavailableError on definite commit failure', async () => {
    const cfg = makeConfig();
    const session = makeMongoSession();
    session.commitTransaction.mockRejectedValue(new Error('definite failure'));

    const connection = makeConnection(session);
    const classifier = {
      classify: jest.fn((e) => e),
      hasLabel: jest.fn(() => false),
    };
    const runner = new TransactionRunner(connection as never, cfg, classifier as never);

    await expect(runner.runManual(async () => 'x')).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
  });
});
