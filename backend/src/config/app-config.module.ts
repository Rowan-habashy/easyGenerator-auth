import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_CONFIG, loadConfig } from './app-config';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, inject: [ConfigService], useFactory: loadConfig }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
