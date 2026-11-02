import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Inject, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { AuthError, RateLimitedError, ValidationError } from '../errors/auth-errors';
import { MongoErrorClassifier } from '../../database/mongo-error-classifier';
import { AppRequest } from '../types/request.types';
import { MONGO_DUPLICATE_KEY } from '../../database/mongo.constants';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('AuthExceptionFilter');

  constructor(
    private readonly classifier: MongoErrorClassifier,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<AppRequest>();
    const res = http.getResponse<Response>();

    const err = this.toAuthError(exception);

    if (err.clearCookie) {
      res.clearCookie(this.cfg.cookie.name, { path: this.cfg.cookie.path });
    }
    if (err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }

    this.logger.warn(
      `code=${err.code} status=${err.status} requestId=${req.id} sessionId=${req.auth?.sessionId ?? '-'}`,
    );

    res.status(err.status).json({
      statusCode: err.status,
      code: err.code,
      message: err.message,
      requestId: req.id,
    });
  }

  private toAuthError(exception: unknown): AuthError {
    if (exception instanceof AuthError) return exception;
    if (exception instanceof ThrottlerException) return new RateLimitedError();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as { message?: string | string[] };
      if (status === 400) return new ValidationError(body?.message ?? 'Validation failed');
      return new AuthError(status, status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR', exception.message);
    }
    if ((exception as { code?: number })?.code === MONGO_DUPLICATE_KEY) return this.classifier.classify(exception);
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return new AuthError(500, 'INTERNAL_ERROR', 'Internal server error');
  }
}
