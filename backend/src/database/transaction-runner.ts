import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';
import { OutcomeUncertainError, ServiceUnavailableError } from '../common/errors/auth-errors';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { LABEL_UNKNOWN_COMMIT } from './mongo.constants';
import { MongoErrorClassifier } from './mongo-error-classifier';

@Injectable()
export class TransactionRunner {
  private readonly logger = new Logger(TransactionRunner.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly classifier: MongoErrorClassifier,
  ) {}


  async run<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result!: T;
      let attemptCount = 0;

      await session.withTransaction(async () => {
        if (++attemptCount > this.cfg.auth.maxTxAttempts) throw new ServiceUnavailableError();
        result = await operation(session);
      });

      return result;
    } catch (error) {
      throw this.classifier.classify(error);
    } finally {
      await session.endSession();
    }
  }


  async runManual<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      let result: T;
      try {
        result = await operation(session);
      } catch (error) {
        await this.abort(session);
        throw error;
      }

      await this.commit(session);
      return result;
    } finally {
      await session.endSession();
    }
  }

  private async commit(session: ClientSession): Promise<void> {
    for (let attemptCount = 1; ; attemptCount++) {
      try {
        await session.commitTransaction();
        return;
      } catch (error) {
        if (this.isUnknownCommit(error)) {
          if (attemptCount >= this.cfg.auth.maxCommitRetries) throw new OutcomeUncertainError();
          continue; 
        }

        await this.abort(session);
        throw new ServiceUnavailableError();
      }
    }
  }

  private isUnknownCommit(error: unknown): boolean {
    return this.classifier.hasLabel(error, LABEL_UNKNOWN_COMMIT);
  }

  private async abort(session: ClientSession): Promise<void> {
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`abortTransaction ignored: ${message}`);
    }
  }
}
