import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { CookieOptions, Response } from 'express';
import { InvalidCredentialsError } from '../common/errors/auth-errors';
import { FailedSigninLimiter } from './failed-signin-limiter';
import { AppRequest } from '../common/types/request.types';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { SignInDto, SignUpDto } from './auth.dto';
import { AuthService } from './auth.service';
import { AUTH_ROUTE } from './auth.constants';

@Controller(AUTH_ROUTE)
export class AuthController {
  private readonly cookieOpts: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    private readonly limiter: FailedSigninLimiter,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {
    this.cookieOpts = {
      httpOnly: true,
      secure: cfg.cookie.secure,
      sameSite: cfg.cookie.sameSite,
      path: cfg.cookie.path,
    };
  }

  @Post('signup')
  async signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.signUp(dto.email, dto.name, dto.password);
    this.setCookie(res, r.refreshToken);
    return { accessToken: r.accessToken, user: r.user };
  }

  @Post('signin')
  @HttpCode(200)
  async signIn(@Body() dto: SignInDto, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip ?? 'unknown';
    await this.limiter.assertAllowed(ip, dto.email);
    let r;
    try {
      r = await this.auth.signIn(dto.email, dto.password);
    } catch (e) {
      if (e instanceof InvalidCredentialsError) await this.limiter.recordFailure(ip, dto.email);
      throw e;
    }
    await this.limiter.reset(ip, dto.email);
    this.setCookie(res, r.refreshToken);
    return { accessToken: r.accessToken, user: r.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.refresh(req.cookies?.[this.cfg.cookie.name]);
    this.setCookie(res, r.refreshToken);
    return { accessToken: r.accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    try {
      await this.auth.logout({
        accessToken: scheme === 'Bearer' ? token : undefined,
        refreshToken: req.cookies?.[this.cfg.cookie.name],
      });
    } finally {
      res.clearCookie(this.cfg.cookie.name, this.cookieOpts);
    }
  }

  private setCookie(res: Response, token: string) {
    res.cookie(this.cfg.cookie.name, token, { ...this.cookieOpts, maxAge: this.cfg.auth.refreshTtlMs });
  }
}
