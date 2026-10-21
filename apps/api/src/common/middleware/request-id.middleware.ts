import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    (req as any).id = requestId;
    res.setHeader('x-request-id', requestId);

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { method, originalUrl } = req;
      const { statusCode } = res;

      this.logger.log(
        JSON.stringify({
          requestId,
          method,
          url: originalUrl,
          statusCode,
          durationMs: duration,
        }),
      );
    });

    next();
  }
}
