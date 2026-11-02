import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AccountDisabledError, InvalidAccessTokenError } from '../common/errors/auth-errors';
import { extractBearerToken } from '../common/http/bearer-token';
import { AppRequest } from '../common/types/request.types';
import { SessionsService } from '../sessions/sessions.service';
import { TokensService } from '../tokens/tokens.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = extractBearerToken(req);
    if (!token) throw new InvalidAccessTokenError();

    const payload = await this.tokens.verifyAccess(token);

    const session = await this.sessions.findActive(payload.sid);
    if (!session || session.userId.toString() !== payload.sub) throw new InvalidAccessTokenError();

    const user = await this.users.findById(payload.sub);
    if (!user) throw new InvalidAccessTokenError();
    if (user.isDisabled) throw new AccountDisabledError();

    req.auth = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }
}
