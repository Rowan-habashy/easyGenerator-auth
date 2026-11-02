import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { makeConfig, mongoError } from '../../test/test-helpers';
import {
  AuthError,
  InvalidRefreshTokenError,
  ServiceUnavailableError,
  ValidationError,
} from '../errors/auth-errors';
import { AuthExceptionFilter } from './auth-exception.filter';

describe('AuthExceptionFilter', () => {
  const cfg = makeConfig();

  const makeRes = () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      clearCookie: jest.fn(),
    };
    return res;
  };

  const hostFor = (req: any, res: any): any => ({
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  });

  it('serializes AuthError and clears cookie when requested', () => {
    const classifier = { isMongoError: jest.fn(() => false), isDuplicateKey: jest.fn(() => false), classify: jest.fn() };
    const filter = new AuthExceptionFilter(classifier as never, cfg);
    const req = { id: 'req-1', auth: { sessionId: 's1' } };
    const res = makeRes();

    filter.catch(new InvalidRefreshTokenError(), hostFor(req, res));

    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFRESH_TOKEN_INVALID', requestId: 'req-1' }));
  });

  it('maps ThrottlerException to rate-limited with retry-after', () => {
    const classifier = { isMongoError: jest.fn(() => false), isDuplicateKey: jest.fn(() => false), classify: jest.fn() };
    const filter = new AuthExceptionFilter(classifier as never, cfg);
    const req = { id: 'req-2' };
    const res = makeRes();

    filter.catch(new ThrottlerException(), hostFor(req, res));

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('maps bad request HttpException into ValidationError shape', () => {
    const classifier = { isMongoError: jest.fn(() => false), isDuplicateKey: jest.fn(() => false), classify: jest.fn() };
    const filter = new AuthExceptionFilter(classifier as never, cfg);
    const req = { id: 'req-3' };
    const res = makeRes();

    filter.catch(new BadRequestException(['email invalid']), hostFor(req, res));

    const payload = res.json.mock.calls[0][0];
    expect(payload.code).toBe(new ValidationError().code);
    expect(payload.message).toContain('email invalid');
  });

  it('uses classifier for mongo errors and falls back to internal error', () => {
    const classifier = {
      isMongoError: jest.fn((e: any) => /^Mongo/.test(e?.name ?? '')),
      isDuplicateKey: jest.fn(() => false),
      classify: jest.fn(() => new ServiceUnavailableError()),
    };
    const filter = new AuthExceptionFilter(classifier as never, cfg);
    const req = { id: 'req-4' };
    const res = makeRes();

    filter.catch(mongoError({ name: 'MongoServerError' }), hostFor(req, res));
    expect(classifier.classify).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);

    res.status.mockClear();
    res.json.mockClear();
    filter.catch(new Error('boom'), hostFor(req, res));
    expect(res.status).toHaveBeenCalledWith(500);
    expect((res.json.mock.calls[0][0] as { code: string }).code).toBe('INTERNAL_ERROR');
  });

  it('maps generic HttpException to HTTP_ERROR/NOT_FOUND', () => {
    const classifier = { isMongoError: jest.fn(() => false), isDuplicateKey: jest.fn(() => false), classify: jest.fn() };
    const filter = new AuthExceptionFilter(classifier as never, cfg);
    const req = { id: 'req-5' };
    const res = makeRes();

    filter.catch(new HttpException('missing', 404), hostFor(req, res));
    expect((res.json.mock.calls[0][0] as { code: string }).code).toBe('NOT_FOUND');
  });
});
