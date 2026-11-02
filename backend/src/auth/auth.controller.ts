import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InvalidCredentialsError } from '../common/errors/auth-errors';
import { extractBearerToken } from '../common/http/bearer-token';
import { clearRefreshCookie, setRefreshCookie } from '../common/http/refresh-cookie';
import { AppRequest } from '../common/types/request.types';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { AuthService } from './auth.service';
import { AUTH_ROUTE } from './auth.constants';
import { AccessTokenResponseDto, AuthSessionResponseDto, SignInDto, SignUpDto } from './auth.dto';
import { AuthResult } from './auth.interface';
import { FailedSigninLimiter } from '../common/helpers/auth/failed-signin-limiter';

@ApiTags('auth')
@Controller(AUTH_ROUTE)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly limiter: FailedSigninLimiter,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create account and start an authenticated session' })
  @ApiBody({ type: SignUpDto })
  @ApiOkResponse({ type: AuthSessionResponseDto, description: 'Account created, refresh cookie set' })
  async signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.signUp(dto.email, dto.name, dto.password);
    setRefreshCookie(res, this.cfg, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('signin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in and issue access token + refresh cookie' })
  @ApiBody({ type: SignInDto })
  @ApiOkResponse({ type: AuthSessionResponseDto, description: 'Signed in, refresh cookie set' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async signIn(@Body() dto: SignInDto, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip ?? 'unknown';
    await this.limiter.assertAllowed(ip, dto.email);

    let result: AuthResult;
    try {
      result = await this.auth.signIn(dto.email, dto.password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) await this.limiter.recordFailure(ip, dto.email);
      throw error;
    }

    await this.limiter.reset(ip, dto.email);
    setRefreshCookie(res, this.cfg, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiCookieAuth()
  @ApiOkResponse({ type: AccessTokenResponseDto, description: 'New access token issued, refresh cookie rotated' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(req.cookies?.[this.cfg.cookie.name]);
    setRefreshCookie(res, this.cfg, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Log out current session and clear refresh cookie' })
  @ApiCookieAuth()
  @ApiNoContentResponse({ description: 'Logged out successfully (cookie cleared even on token failure)' })
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    try {
      await this.auth.logout({
        accessToken: extractBearerToken(req),
        refreshToken: req.cookies?.[this.cfg.cookie.name],
      });
    } finally {
      clearRefreshCookie(res, this.cfg); 
    }
  }
}
