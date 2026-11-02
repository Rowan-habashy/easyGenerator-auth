import { CookieOptions, Response } from 'express';
import { AppConfig } from '../../config/app-config';

const cookieOptions = (cfg: AppConfig): CookieOptions => ({
  httpOnly: true,
  secure: cfg.cookie.secure,
  sameSite: cfg.cookie.sameSite,
  path: cfg.cookie.path,
});

export const setRefreshCookie = (res: Response, cfg: AppConfig, token: string): void => {
  res.cookie(cfg.cookie.name, token, { ...cookieOptions(cfg), maxAge: cfg.auth.refreshTtlMs });
};

export const clearRefreshCookie = (res: Response, cfg: AppConfig): void => {
  res.clearCookie(cfg.cookie.name, cookieOptions(cfg));
};
