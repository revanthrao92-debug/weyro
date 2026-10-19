import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) || crypto.randomUUID();
    response.setHeader('x-request-id', requestId);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = 'Internal Server Error';
    let message: string | string[] | object = 'An unexpected error occurred';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          errorName = 'Conflict';
          const target = (exception.meta?.target as string[]) || ['resource'];
          message = `Unique constraint violation: record with this ${target.join(', ')} already exists`;
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          errorName = 'Not Found';
          message =
            (exception.meta?.cause as string) ||
            'The requested record was not found or has been modified';
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          errorName = 'Bad Request';
          const field = exception.meta?.field_name || 'referenced entity';
          message = `Foreign key constraint failed on ${field}`;
          break;
        }
        case 'P2014': {
          status = HttpStatus.BAD_REQUEST;
          errorName = 'Bad Request';
          message = 'The change would violate the required relationship between models';
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          errorName = 'Database Error';
          message = `Database query error (${exception.code})`;
          break;
        }
      }
      this.logger.warn(
        `[Request ${requestId}] Prisma Error ${exception.code}: ${JSON.stringify(message)} on ${request.method} ${request.url}`,
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const resObj = res as any;
        errorName = resObj.error || exception.name;
        message = resObj.message || exception.message;
      } else {
        errorName = exception.name;
        message = res;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[Request ${requestId}] Unhandled Exception: ${exception.message} on ${request.method} ${request.url}`,
        exception.stack,
      );
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      error: errorName,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
