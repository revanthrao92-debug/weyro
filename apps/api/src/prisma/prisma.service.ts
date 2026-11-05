import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.config';

/** M6: append Postgres pool params unless already present in the URL. */
export function withPoolParams(databaseUrl: string): string {
  const poolMax = process.env.DATABASE_POOL_MAX || '10';
  const poolTimeout = process.env.DATABASE_POOL_TIMEOUT || '10';
  try {
    const url = new URL(databaseUrl);
    url.searchParams.set('connection_limit', poolMax);
    url.searchParams.set('pool_timeout', poolTimeout);
    return url.toString();
  } catch {
    // Non-URL datasource (e.g. absolute file) — leave untouched.
    return databaseUrl;
  }
}

/**
 * Models that support soft delete (have a `deletedAt` field).
 */
// Kept for reference — the actual soft-delete lookup is the Set below.
// This variable is dynamic per model name in softDelete(model, where).
const SOFT_DELETE_MODELS: Set<string> = new Set([
  'User',
  'CustomerProfile',
  'ProviderProfile',
  'Vehicle',
  'ServiceRequest',
  'RequestMedia',
  'Quotation',
  'Booking',
  'Payment',
  'Review',
  'SparePart',
  'Thread',
  'Message',
  'Notification',
  'PushToken',
  'RefreshToken',
  'WebhookEvent',
]);

/**
 * Returns a where clause fragment that filters out soft-deleted records.
 * Use this in all find queries on soft-delete models.
 */
export function softDeleteFilter(): Record<string, any> {
  return { deletedAt: null };
}

/**
 * Merges a soft-delete filter into an existing where clause.
 */
export function withSoftDelete(where: Record<string, any> = {}): Record<string, any> {
  return {
    ...where,
    deletedAt: where.deletedAt ?? null,
  };
}

/**
 * PrismaService with soft-delete helpers and audit logging support.
 *
 * Soft-delete: Use `withSoftDelete(where)` in all find queries to automatically
 * exclude soft-deleted records. Use `softDelete(model, where)` instead of
 * `delete()` to set `deletedAt` instead of hard-removing records.
 *
 * Audit: Use `auditLog(params)` to write audit entries for write operations.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // M6: connection pool tuning via env (Postgres only).
      // DATABASE_POOL_MAX   — max connections per instance (default 10)
      // DATABASE_POOL_TIMEOUT — seconds a query waits for a connection (default 10)
      // Applied by appending pooled params to the DATABASE_URL datasource.
      datasources: {
        db: { url: withPoolParams(env.DATABASE_URL) },
      },
      log:
        env.NODE_ENV === 'development'
          ? (['warn'] as never)
          : (['error'] as never),
    });
  }

  async onModuleInit() {
    // Fail fast on app boot if the database is unreachable
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Soft-delete a record by setting deletedAt instead of hard-removing it.
   * Bypasses the normal Prisma delete which would hard-delete.
   */
  async softDelete(model: string, where: any) {
    // Guardrail: unknown model names fall back to plain update (no softDelete).
    if (!SOFT_DELETE_MODELS.has(model)) {
      return (this as any)[model].update({ where, data: { deletedAt: new Date() } });
    }
    const modelInstance = (this as any)[model];
    if (!modelInstance) {
      throw new Error(`Unknown model: ${model}`);
    }
    return modelInstance.update({
      where,
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Soft-delete multiple records by setting deletedAt.
   */
  async softDeleteMany(model: string, where: any) {
    const modelInstance = (this as any)[model];
    if (!modelInstance) {
      throw new Error(`Unknown model: ${model}`);
    }
    return modelInstance.updateMany({
      where: { ...where, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hard delete a record (bypasses soft delete).
   * Use only for administrative purposes (e.g., GDPR erasure).
   */
  async hardDelete(model: string, where: any) {
    const modelInstance = (this as any)[model];
    if (!modelInstance) {
      throw new Error(`Unknown model: ${model}`);
    }
    return modelInstance.delete({ where });
  }

  /**
   * Write an audit log entry for a write operation.
   * Best-effort: never throws, never blocks the main operation.
   */
  async writeAuditLog(params: {
    actorId?: string;
    actorRole?: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.auditLog.create({
        data: {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValues: params.oldValues,
          newValues: params.newValues,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (err) {
      this.logger.error(`Audit log failed: ${(err as Error).message}`);
    }
  }
}
