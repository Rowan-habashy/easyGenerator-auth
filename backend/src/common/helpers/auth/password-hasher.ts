import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { APP_CONFIG, AppConfig } from '../../../config/app-config';

@Injectable()
export class PasswordHasher {
  private readonly dummyHash: string;

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {
    this.dummyHash = bcrypt.hashSync(bcrypt.genSaltSync(this.cfg.auth.bcryptRounds), this.cfg.auth.bcryptRounds);
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cfg.auth.bcryptRounds);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async compareDummy(password: string): Promise<void> {
    await bcrypt.compare(password, this.dummyHash);
  }
}
