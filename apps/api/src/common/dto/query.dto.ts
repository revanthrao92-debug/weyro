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
  kind: z.enum(['PART', 'PACKAGE']).optional(),
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
  /** "true": only jobs still in progress (confirmed, on the way, working), however old. */
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const sparePartOrderQuerySchema = cursorPaginationSchema.extend({
  status: z
    .enum(['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'])
    .optional(),
  fulfillmentStatus: z
    .enum(['PENDING', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
    .optional(),
  /** "true": only paid orders the dealer still has to pack, ship or mark delivered. */
  needsAction: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const adminActivityQuerySchema = cursorPaginationSchema.extend({
  action: z.string().max(100).optional(),
});

export const adminOrdersQuerySchema = z
  .object({
    status: z
      .enum(['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'])
      .optional(),
    fulfillmentStatus: z
      .enum(['PENDING', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
      .optional(),
  })
  .strict();

export const adminBookingsQuerySchema = z
  .object({
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
    category: z
      .enum(['REPAIR', 'MAINTENANCE', 'SPARE_PART', 'TOWING', 'ROADSIDE', 'INSPECTION'])
      .optional(),
  })
  .strict();

export const providerAdminQuerySchema = z
  .object({
    status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).optional(),
  })
  .strict();

export type CursorPaginationQuery = z.infer<typeof cursorPaginationSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type SparePartsQuery = z.infer<typeof sparePartsQuerySchema>;
export type BookingsQuery = z.infer<typeof bookingsQuerySchema>;
export type SparePartOrderQuery = z.infer<typeof sparePartOrderQuerySchema>;
export type ProviderAdminQuery = z.infer<typeof providerAdminQuerySchema>;
export type AdminActivityQuery = z.infer<typeof adminActivityQuerySchema>;
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;
export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;

/** A Weyro reference number as typed by an admin; the service checks the format and check digit. */
export const adminLookupQuerySchema = z.object({ ref: z.string().trim().min(1).max(40) }).strict();
export type AdminLookupQuery = z.infer<typeof adminLookupQuerySchema>;
