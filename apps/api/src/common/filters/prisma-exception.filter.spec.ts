import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter logging of server errors', () => {
  const run = (exception: unknown) => {
    const json = jest.fn();
    const response = { setHeader: jest.fn(), status: jest.fn(() => ({ json })) };
    const request = { headers: {}, method: 'POST', url: '/api/v1/x' };
    const host = {
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    } as any;
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new PrismaExceptionFilter().catch(exception, host);
    const logged = error.mock.calls.map((c) => String(c[0]));
    error.mockRestore();
    return { logged, status: response.status.mock.calls[0][0], body: json.mock.calls[0][0] };
  };

  it('logs a 5xx HttpException (previously only sent to Sentry)', () => {
    const { logged, status, body } = run(new ServiceUnavailableException('gateway down'));
    expect(status).toBe(503);
    expect(body.message).toBe('An unexpected error occurred');
    expect(logged.some((l) => l.includes('gateway down'))).toBe(true);
  });

  it('logs a non-Error throwable instead of a silent 500', () => {
    const { logged, status } = run({ statusCode: 400, error: { description: 'The id provided does not exist' } });
    expect(status).toBe(500);
    expect(logged.some((l) => l.includes('The id provided does not exist'))).toBe(true);
  });
});
