import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { from, Observable, of, switchMap, tap, catchError, throwError } from 'rxjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

/**
 * Idempotency interceptor for mutating endpoints (POST/PATCH/PUT/DELETE).
 *
 * Clients send an Idempotency-Key header (UUID). The interceptor:
 * 1. Tries to CREATE an IdempotencyKey record with PENDING status
 * 2. If the key already exists (P2002 unique violation), returns the cached
 *    response if PROCESSED, or waits briefly for the other request to finish
 * 3. If created successfully, executes the handler and caches the response
 *
 * Keys expire after 24 hours (IdempotencyKey.expiresAt).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Only apply to mutating methods
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey =
      request.headers['idempotency-key'] ||
      request.headers['x-idempotency-key'];

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return next.handle();
    }

    const key = idempotencyKey as string;
    const endpoint = request.route?.path || request.path;
    const method = request.method;
    const userId = request.user?.sub;
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(request.body || {}))
      .digest('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Try to claim the idempotency key (create PENDING record)
    return from(
      this.prisma.idempotencyKey.create({
        data: {
          key,
          endpoint,
          method,
          userId,
          requestHash,
          status: 'PENDING',
          expiresAt,
        },
      }),
    ).pipe(
      // Claim succeeded - execute handler and cache response
      tap(async () => {
        this.logger.log(
          `Idempotency key claimed: ${key.slice(0, 8)}... ${method} ${endpoint}`,
        );
      }),
      switchMap(() => next.handle()),
      tap(async (result: any) => {
        // Capture the response and update the idempotency key
        const statusCode = response.statusCode || 200;
        await this.prisma.idempotencyKey.update({
          where: { key },
          data: {
            status: 'PROCESSED',
            responseStatus: statusCode,
            responseBody: result as any,
            processedAt: new Date(),
          },
        });
      }),
      catchError((err: any) => {
        // Mark the key as FAILED if the handler errors
        from(
          this.prisma.idempotencyKey.update({
            where: { key },
            data: { status: 'FAILED' },
          }),
        ).subscribe(() => {}, () => {}); // Never block due to audit errors
        return throwError(() => err);
      }),
    ).pipe(
      catchError((err: any) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Key already claimed by another request - wait for it to complete
          return this.handleKeyClaimedByAnother(
            key,
            endpoint,
            method,
            response,
          );
        }
        return throwError(() => err);
      }),
    );
  }

  /**
   * Handle the case where another request already claimed the idempotency key.
   * Wait for the other request to finish and return its cached response.
   */
  private handleKeyClaimedByAnother(
    key: string,
    endpoint: string,
    method: string,
    response: any,
  ): Observable<any> {
    this.logger.log(
      `Idempotency key already claimed: ${key.slice(0, 8)}... ${method} ${endpoint}`,
    );

    // Poll for up to 5 seconds for the other request to complete
    const maxAttempts = 50;
    const intervalMs = 100;

    return new Observable<any>((subscriber) => {
      let attempts = 0;

      const poll = () => {
        from(
          this.prisma.idempotencyKey.findUnique({ where: { key } }),
        ).subscribe({
          next: (record: any) => {
            attempts++;

            if (
              record &&
              record.status === 'PROCESSED' &&
              record.responseStatus &&
              record.responseBody
            ) {
              this.logger.log(
                `Idempotent replay for key ${key.slice(0, 8)}... on ${method} ${endpoint}`,
              );
              response.status(record.responseStatus);
              subscriber.next(record.responseBody);
              subscriber.complete();
            } else if (record && record.status === 'FAILED') {
              subscriber.error(
                new Error('Previous request with this idempotency key failed'),
              );
            } else if (attempts >= maxAttempts) {
              subscriber.error(
                new Error('Timeout waiting for idempotent request to complete'),
              );
            } else {
              setTimeout(poll, intervalMs);
            }
          },
          error: (err) => subscriber.error(err),
        });
      };

      poll();
    });
  }
}
