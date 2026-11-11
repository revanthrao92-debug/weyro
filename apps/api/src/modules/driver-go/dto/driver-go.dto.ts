import { z } from 'zod';

export const driverAvailabilityRuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .strict()
  .refine((rule) => rule.startMinute < rule.endMinute, {
    message: 'Start time must be before end time',
    path: ['endMinute'],
  });

export const driverAvailabilitySchema = z
  .object({
    rules: z.array(driverAvailabilityRuleSchema).max(21),
  })
  .strict();

export const driverOnlineSchema = z
  .object({ isOnline: z.boolean() })
  .strict();

export const driverDeclineSchema = z
  .object({ reason: z.string().max(300).optional() })
  .strict();

export const driverJobStatusSchema = z
  .object({
    status: z.enum(['DRIVER_EN_ROUTE', 'ARRIVED', 'COMPLETED']),
  })
  .strict();

export const driverStartOtpSchema = z
  .object({ code: z.string().regex(/^\d{4}$/, 'Enter the 4-digit start code') })
  .strict();

export const driverJobsQuerySchema = z
  .object({
    status: z
      .enum([
        'REQUESTED',
        'CONFIRMED',
        'DRIVER_EN_ROUTE',
        'ARRIVED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED',
        'DISPUTED',
      ])
      .optional(),
  })
  .strict();

export class UpdateDriverOnlineDto {
  static readonly schema = driverOnlineSchema;
  isOnline!: boolean;
}

export class DriverAvailabilityDto {
  static readonly schema = driverAvailabilitySchema;
  rules!: Array<{
    weekday: number;
    startMinute: number;
    endMinute: number;
  }>;
}

export class DeclineDriverJobDto {
  static readonly schema = driverDeclineSchema;
  reason?: string;
}

export class DriverJobStatusDto {
  static readonly schema = driverJobStatusSchema;
  status!: 'DRIVER_EN_ROUTE' | 'ARRIVED' | 'COMPLETED';
}

export class DriverStartOtpDto {
  static readonly schema = driverStartOtpSchema;
  code!: string;
}

export type DriverJobsQuery = z.infer<typeof driverJobsQuerySchema>;
