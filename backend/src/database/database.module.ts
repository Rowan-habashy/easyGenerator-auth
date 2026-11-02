import { Global, Module } from '@nestjs/common';
import { MongoErrorClassifier } from './mongo-error-classifier';
import { TransactionRunner } from './transaction-runner';

@Global()
@Module({
  providers: [MongoErrorClassifier, TransactionRunner],
  exports: [MongoErrorClassifier, TransactionRunner],
})
export class DatabaseModule {}
