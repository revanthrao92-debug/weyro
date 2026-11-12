import { z } from 'zod';

export const availableDriversQuerySchema = z
  .object({
    startAt: z.string().datetime(),
    engagement: z.enum(['HOURLY', 'DAILY']).default('HOURLY'),
    durationHours: z.coerce.number().int().min(2).max(12).optional(),
    durationDays: z.coerce.number().int().min(1).max(1).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    transmission: z.enum(['MANUAL', 'AUTOMATIC']).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.engagement === 'HOURLY' && data.durationHours === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationHours'],
        message: 'Choose how many hours you need.',
      });
    }
    if (data.engagement === 'DAILY' && data.durationDays === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationDays'],
        message: 'Choose the number of days.',
      });
    }
  });

export type AvailableDriversQuery = z.infer<typeof availableDriversQuerySchema>;

export const createDriverBookingSchema = z
  .object({
    driverId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    engagement: z.enum(['HOURLY', 'DAILY']),
    scheduleMode: z.enum(['ON_DEMAND', 'SCHEDULED']).default('SCHEDULED'),
    pickupAddress: z.string().min(3).max(500),
    pickupLatitude: z.number().min(-90).max(90),
    pickupLongitude: z.number().min(-180).max(180),
    startAt: z.string().datetime(),
    durationHours: z.number().int().min(2).max(12).optional(),
    durationDays: z.number().int().min(1).max(1).optional(),
    notes: z.string().max(500).optional(),
    transmission: z.enum(['MANUAL', 'AUTOMATIC']).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.engagement === 'HOURLY' && data.durationHours === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationHours'],
        message: 'Choose how many hours you need.',
      });
    }
    if (data.engagement === 'DAILY' && data.durationDays === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationDays'],
        message: 'Choose the number of days.',
      });
    }
  });

export type CreateDriverBookingInput = z.infer<typeof createDriverBookingSchema>;

export class CreateDriverBookingDto implements CreateDriverBookingInput {
  static readonly schema = createDriverBookingSchema;

  driverId!: string;
  vehicleId!: string;
  engagement!: 'HOURLY' | 'DAILY';
  scheduleMode!: 'ON_DEMAND' | 'SCHEDULED';
  pickupAddress!: string;
  pickupLatitude!: number;
  pickupLongitude!: number;
  startAt!: string;
  durationHours?: number;
  durationDays?: number;
  notes?: string;
  transmission?: 'MANUAL' | 'AUTOMATIC';
}
