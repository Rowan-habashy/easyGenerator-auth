import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { SessionEntity, SessionSchema } from './session.schema';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: SessionEntity.name,
        inject: [APP_CONFIG],
        useFactory: (cfg: AppConfig) => {
          SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: cfg.auth.purgeAfterSeconds });
          return SessionSchema;
        },
      },
    ]),
  ],
  providers: [SessionsService, SessionsRepository],
  exports: [SessionsService],
})
export class SessionsModule {}
