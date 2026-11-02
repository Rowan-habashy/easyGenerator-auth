import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { InvalidAccessTokenError } from '../common/errors/auth-errors';
import { AppRequest } from '../common/types/request.types';
import { toPublicUser, UsersService } from './users.service';
import { USERS_ROUTE } from './users.constants';

@ApiTags('users')
@Controller(USERS_ROUTE)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({
    description: 'Authenticated user profile',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '665f7ae8d2fdd3fadc5f9d61' },
        email: { type: 'string', example: 'rowan@example.com' },
        name: { type: 'string', example: 'Rowan Habashy' },
        createdAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'email', 'name', 'createdAt'],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async me(@Req() req: AppRequest) {
    const user = await this.users.findById(req.auth!.userId);
    if (!user) throw new InvalidAccessTokenError();
    return toPublicUser(user);
  }
}
