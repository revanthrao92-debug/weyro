import { z } from 'zod';

export const cursorPaginationSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const feedQuerySchema = cursorPaginationSchema.extend({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(200).default(25),
  category: z
    .enum([
      'REPAIR',
      'MAINTENANCE',
      'SPARE_PART',
      'TOWING',
      'ROADSIDE',
      'INSPECTION',
    ])
    .optional(),
});

export const sparePartsQuerySchema = cursorPaginationSchema.extend({
  search: z.string().min(1).max(100).optional(),
  make: z.string().min(1).max(50).optional(),
  model: z.string().min(1).max(50).optional(),
  condition: z.enum(['OEM', 'AFTERMARKET', 'USED']).optional(),
});

export const bookingsQuerySchema = cursorPaginationSchema.extend({
  status: z
    .enum([
      'CONFIRMED',
      'PROVIDER_EN_ROUTE',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'DISPUTED',
    ])
    .optional(),
});

export const providerAdminQuerySchema = z
  .object({
    status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).optional(),
  })
  .strict();

export type CursorPaginationQuery = z.infer<typeof cursorPaginationSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type SparePartsQuery = z.infer<typeof sparePartsQuerySchema>;
export type BookingsQuery = z.infer<typeof bookingsQuerySchema>;
export type ProviderAdminQuery = z.infer<typeof providerAdminQuerySchema>;
