import { httpSerializers } from './http-serializers';

describe('httpSerializers', () => {
  it('never includes request headers (no bearer tokens in logs)', () => {
    const out = httpSerializers.req({
      id: 'req_1',
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { authorization: 'Bearer super-secret-token', cookie: 'a=b' },
    } as never);

    expect(out).toEqual(
      expect.objectContaining({ id: 'req_1', method: 'POST', url: '/api/v1/auth/login' }),
    );
    expect(out).not.toHaveProperty('headers');
    expect(JSON.stringify(out)).not.toContain('super-secret-token');
  });

  it('serializes only the response status code', () => {
    const out = httpSerializers.res({ statusCode: 401, headers: { 'set-cookie': 'x' } } as never);
    expect(out).toEqual({ statusCode: 401 });
  });
});
