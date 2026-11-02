import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { OriginRejectedError } from '../errors/auth-errors';
import { AppRequest } from '../types/request.types';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: string;
  private readonly protectedPrefix: string;

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.allowed = cfg.frontendOrigin;
    this.protectedPrefix = `${cfg.cookie.path}/`;
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (req.method === 'POST' && req.path.startsWith(this.protectedPrefix)) {
      if (req.headers.origin !== this.allowed) throw new OriginRejectedError();
    }
    return true;
  }
}
