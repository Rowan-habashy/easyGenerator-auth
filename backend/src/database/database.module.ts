import { Global, Module } from '@nestjs/common';
import { MongoErrorClassifier } from './mongo-error-classifier';

@Global()
@Module({
  providers: [MongoErrorClassifier],
  exports: [MongoErrorClassifier],
})
export class DatabaseModule {}
