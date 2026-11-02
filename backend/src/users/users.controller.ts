import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { InvalidAccessTokenError } from '../common/errors/auth-errors';
import { AppRequest } from '../common/types/request.types';
import { toPublicUser, UsersService } from './users.service';
import { USERS_ROUTE } from './users.constants';

@Controller(USERS_ROUTE)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: AppRequest) {
    const user = await this.users.findById(req.auth!.userId);
    if (!user) throw new InvalidAccessTokenError();
    return toPublicUser(user);
  }
}
