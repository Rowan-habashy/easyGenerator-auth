import { extractBearerToken } from './bearer-token';

describe('extractBearerToken', () => {
  it('returns token for valid Bearer header', () => {
    const req: any = { headers: { authorization: 'Bearer abc.def' } };
    expect(extractBearerToken(req)).toBe('abc.def');
  });

  it('returns undefined for malformed or missing header', () => {
    expect(extractBearerToken({ headers: {} } as any)).toBeUndefined();
    expect(extractBearerToken({ headers: { authorization: 'Basic x' } } as any)).toBeUndefined();
    expect(extractBearerToken({ headers: { authorization: 'Bearer' } } as any)).toBeUndefined();
  });
});
