import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';
import { AppRequest } from '../types/request.types';

export function requestIdMiddleware(req: AppRequest, res: Response, next: NextFunction) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
