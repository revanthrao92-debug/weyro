import { z } from 'zod';

/**
 * Route-parameter id guard. IDs are opaque strings (cuid/uuid) — reject
 * anything outside the safe charset before it reaches Prisma.
 */
export const idParamSchema = z
  .string()
  .min(1, 'id is required')
  .max(64, 'id is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'id contains invalid characters');

export type IdParam = z.infer<typeof idParamSchema>;
