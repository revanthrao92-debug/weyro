import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const updateCustomerProfileSchema = z
  .object({
    firstName: z.string().min(1).max(60).optional(),
    lastName: z.string().min(1).max(60).optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export class UpdateCustomerProfileDto
  implements z.infer<typeof updateCustomerProfileSchema>
{
  static readonly schema = updateCustomerProfileSchema;

  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

export const savedAddressSchema = z
  .object({
    id: z.string().max(60).optional(),
    title: z.string().min(1).max(60),
    address: z.string().min(5).max(300),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export const updateAddressesSchema = z
  .object({
    addresses: z.array(savedAddressSchema).max(10),
  })
  .strict();

export class UpdateAddressesDto
  implements z.infer<typeof updateAddressesSchema>
{
  static readonly schema = updateAddressesSchema;

  addresses!: Array<z.infer<typeof savedAddressSchema>>;
}

export const createVehicleSchema = z
  .object({
    make: z.string().min(1).max(60),
    model: z.string().min(1).max(60),
    year: z.number().int().min(1900).max(currentYear + 1),
    registrationNumber: z.string().min(4).max(20),
    vinNumber: z.string().min(5).max(40).optional(),
    fuelType: z
      .enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'])
      .optional(),
    color: z.string().min(1).max(30).optional(),
  })
  .strict();

export class CreateVehicleDto implements z.infer<typeof createVehicleSchema> {
  static readonly schema = createVehicleSchema;

  make!: string;
  model!: string;
  year!: number;
  registrationNumber!: string;
  vinNumber?: string;
  fuelType?: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG';
  color?: string;
}

export const updateVehicleSchema = createVehicleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export class UpdateVehicleDto implements z.infer<typeof updateVehicleSchema> {
  static readonly schema = updateVehicleSchema;

  make?: string;
  model?: string;
  year?: number;
  registrationNumber?: string;
  vinNumber?: string;
  fuelType?: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG';
  color?: string;
}
