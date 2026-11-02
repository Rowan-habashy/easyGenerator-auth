import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { RefreshToken, RefreshTokenSchema } from './refresh-token.schema';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: RefreshToken.name,
        inject: [APP_CONFIG],
        useFactory: (cfg: AppConfig) => {
          RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: cfg.auth.purgeAfterSeconds });
          return RefreshTokenSchema;
        },
      },
    ]),
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        secret: cfg.jwt.secret,
        signOptions: { expiresIn: cfg.jwt.expiresIn as never, algorithm: cfg.jwt.algorithm },
        verifyOptions: { algorithms: [cfg.jwt.algorithm] },
      }),
    }),
  ],
  providers: [TokensService, RefreshTokensRepository],
  exports: [TokensService],
})
export class TokensModule {}
