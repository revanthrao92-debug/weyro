import {
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

/**
 * Idempotency middleware for mutating endpoints (POST/PATCH/PUT).
 *
 * Clients send an Idempotency-Key header (UUID). The middleware:
 * 1. Checks if the key was already processed for this endpoint+user
 * 2. If yes, returns the cached response without re-executing the handler
 * 3. If no, executes the handler, caches the response, and returns it
 *
 * Keys expire after 24 hours (set by the IdempotencyKey.expiresAt field).
 */
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: () => void) {
    // Only apply to mutating methods
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'];

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return next();
    }

    const key = idempotencyKey as string;
    const endpoint = req.route?.path || req.path;
    const method = req.method;
    const userId = (req as any).user?.sub;

    // Compute hash of request body for deduplication
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body))
      .digest('hex');

    try {
      // Check if this key was already processed
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { key },
      });

      if (existing) {
        // Key exists and was processed - return cached response
        if (
          existing.status === 'PROCESSED' &&
          existing.responseStatus &&
          existing.responseBody
        ) {
          this.logger.log(
            `Idempotent replay for key ${key.slice(0, 8)}... on ${method} ${endpoint}`,
          );
          res.status(existing.responseStatus).json(existing.responseBody);
          return;
        }

        // Key exists but still pending - another request is processing it
        // Wait briefly and check again (handles concurrent retries)
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const updated = await this.prisma.idempotencyKey.findUnique({
            where: { key },
          });
          if (
            updated?.status === 'PROCESSED' &&
            updated?.responseStatus &&
            updated?.responseBody
          ) {
            res.status(updated.responseStatus).json(updated.responseBody);
            return;
          }
        }

        // Still pending after waiting - proceed but warn
        this.logger.warn(
          `Idempotency key ${key.slice(0, 8)}... still pending after wait`,
        );
      }

      // Create the idempotency key record as PENDING
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          endpoint,
          method,
          userId,
          requestHash,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Store the original send/json methods to capture the response
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);
      let capturedStatus: number | undefined;
      let capturedBody: any = undefined;

      // Override res.status to capture the status code
      (res as any).status = ((code: number) => {
        capturedStatus = code;
        return originalStatus(code);
      }) as any;

      // Override res.json to capture the response body
      (res as any).json = ((body: any) => {
        capturedBody = body;
        return originalJson(body);
      }) as any;

      // Call the next middleware/handler
      next();

      // After the handler completes, save the captured response
      if (capturedStatus !== undefined) {
        await this.prisma.idempotencyKey.update({
          where: { key },
          data: {
            status: 'PROCESSED',
            responseStatus: capturedStatus,
            responseBody: capturedBody,
            processedAt: new Date(),
          },
        });
      }
    } catch (err) {
      this.logger.error(
        `Idempotency middleware error: ${(err as Error).message}`,
      );
      // Never block the request due to idempotency errors
      next();
    }
  }
}
