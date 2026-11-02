import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  it('sets request id and response header then calls next', () => {
    const req: any = {};
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(typeof req.id).toBe('string');
    expect(req.id.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
