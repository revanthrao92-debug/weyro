import { Injectable, LoggerService } from '@nestjs/common';
import pino from 'pino';

/**
 * Pino-based structured logger implementing NestJS LoggerService.
 * Replaces NestJS's default console logger with structured JSON output,
 * request ID correlation, and log levels.
 */
@Injectable()
export class PinoLogger implements LoggerService {
  readonly logger: pino.Logger;

  constructor(context?: string) {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
      base: {
        service: 'weyro-api',
        env: process.env.NODE_ENV || 'development',
        ...(context ? { context } : {}),
      },
    });
  }

  child(context: string): PinoLogger {
    const childLogger = new PinoLogger();
    (childLogger.logger as any) = this.logger.child({ context });
    return childLogger;
  }

  log(message: string, context?: string) {
    this.logger.info(context ? { context } : undefined, message);
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(
      context ? { context, trace } : { trace },
      message,
    );
  }

  warn(message: string, context?: string) {
    this.logger.warn(context ? { context } : undefined, message);
  }

  debug(message: string, context?: string) {
    this.logger.debug(context ? { context } : undefined, message);
  }

  verbose(message: string, context?: string) {
    this.logger.trace(context ? { context } : undefined, message);
  }
}
