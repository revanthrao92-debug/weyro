import { z } from 'zod';

export const updateProviderProfileSchema = z
  .object({
    businessName: z.string().min(2).max(120).optional(),
    description: z.string().min(10).max(1000).optional(),
    phone: z.string().min(8).max(20).optional(),
    address: z.string().min(5).max(300).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    serviceRadiusKm: z.number().min(1).max(200).optional(),
    isAvailable: z.boolean().optional(),
    towingVehicleTypes: z
      .array(z.enum(['FLATBED', 'HOOK_AND_CHAIN', 'MOTORCYCLE', 'ANY']))
      .optional(),
    maxVehicleWeightKg: z.number().int().min(0).max(50000).nullable().optional(),
    towingBaseFee: z.number().min(0).nullable().optional(),
    towingPerKmFee: z.number().min(0).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .refine(
    (value) =>
      (value.latitude === undefined) === (value.longitude === undefined),
    { message: 'latitude and longitude must be provided together' },
  );

export class UpdateProviderProfileDto
  implements z.infer<typeof updateProviderProfileSchema>
{
  static readonly schema = updateProviderProfileSchema;

  businessName?: string;
  description?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm?: number;
  isAvailable?: boolean;
  towingVehicleTypes?: Array<
    'FLATBED' | 'HOOK_AND_CHAIN' | 'MOTORCYCLE' | 'ANY'
  >;
  maxVehicleWeightKg?: number | null;
  towingBaseFee?: number | null;
  towingPerKmFee?: number | null;
}
