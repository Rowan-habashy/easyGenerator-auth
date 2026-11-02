import { Request } from 'express';

export const extractBearerToken = (req: Request): string | undefined => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
};
