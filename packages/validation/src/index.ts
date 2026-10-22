import { z } from 'zod';

// Auth validation
export const RegisterSchema = z
  .object({
    email: z.string().email(),
    phone: z.string().min(10).max(15),
    password: z.string().min(8),
    role: z.enum(['CUSTOMER', 'PROVIDER', 'BOTH']).default('CUSTOMER'),
    firstName: z.string().min(1).default('Customer'),
    lastName: z.string().min(1).default('User'),
    businessName: z.string().optional(),
    providerType: z
      .enum([
        'MECHANIC',
        'GARAGE',
        'AUTHORIZED_CENTER',
        'PARTS_DEALER',
        'TOWING',
        'ROADSIDE',
      ])
      .optional(),
    description: z.string().optional(),
    address: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    towingVehicleTypes: z
      .array(z.enum(['FLATBED', 'HOOK_AND_CHAIN', 'MOTORCYCLE', 'ANY']))
      .max(4)
      .optional(),
    maxVehicleWeightKg: z.number().int().min(50).max(50000).optional(),
    towingBaseFee: z.number().min(0).max(100000).optional(),
    towingPerKmFee: z.number().min(0).max(10000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      (data.role === 'PROVIDER' || data.role === 'BOTH') &&
      (data.latitude === undefined || data.longitude === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Provider registration requires latitude and longitude',
      });
    }
    if (
      data.providerType === 'TOWING' &&
      (!data.towingVehicleTypes || data.towingVehicleTypes.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['towingVehicleTypes'],
        message: 'Select at least one towing vehicle type',
      });
    }
  });

export const LoginSchema = z
  .object({
    emailOrPhone: z.string().min(3),
    password: z.string().min(1),
    email: z.string().optional(),
  })
  .strict();

export const RefreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

// Vehicle validation
export const CreateVehicleSchema = z
  .object({
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
    registrationNumber: z.string().min(4).max(20),
    vinNumber: z.string().optional(),
    fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG']),
    color: z.string().optional(),
  })
  .strict();

// Service Request validation
export const CreateServiceRequestSchema = z
  .object({
    vehicleId: z.string().optional(),
    vehicleMake: z.string().optional(),
    vehicleModel: z.string().optional(),
    vehicleYear: z.number().int().optional(),
    category: z
      .enum([
        'REPAIR',
        'MAINTENANCE',
        'SPARE_PART',
        'TOWING',
        'ROADSIDE',
        'INSPECTION',
        'MECHANICAL',
        'BODYWORK',
      ])
      .default('REPAIR'),
    title: z.string().min(3).max(150),
    description: z.string().min(5).max(2000),
    address: z.string().min(3),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).default('NORMAL'),
    mediaUrls: z.array(z.string()).default([]),
    damagePhotos: z.array(z.string()).default([]),
    isBroadcast: z.boolean().default(true),
    fulfillmentType: z
      .enum(['ON_SITE', 'WORKSHOP_VISIT', 'PARTS_SHIPPING', 'TOW_TO_GARAGE'])
      .optional(),
    // Towing details (required when category === 'TOWING')
    dropoffAddress: z.string().min(3).max(500).optional(),
    dropoffLatitude: z.number().min(-90).max(90).optional(),
    dropoffLongitude: z.number().min(-180).max(180).optional(),
    towingVehicleType: z
      .enum(['FLATBED', 'HOOK_AND_CHAIN', 'MOTORCYCLE', 'ANY'])
      .optional(),
    vehicleWeightKg: z.number().int().min(50).max(50000).optional(),
    expiresInDays: z.number().int().min(1).max(30).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.category !== 'TOWING') return;

    if (data.dropoffAddress === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dropoffAddress'],
        message: 'Towing requests require a dropoff address',
      });
    }
    if (
      data.dropoffLatitude === undefined ||
      data.dropoffLongitude === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dropoffLatitude'],
        message: 'Towing requests require dropoff coordinates',
      });
    }
    if (data.towingVehicleType === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['towingVehicleType'],
        message: 'Select the towing equipment required',
      });
    }
  });

// Quotation validation (Note: totalCost is computed server-side, providerId is derived from JWT)
export const CreateQuotationSchema = z
  .object({
    partsCost: z.number().min(0),
    labourCost: z.number().min(0).default(0),
    shippingCost: z.number().min(0).optional(),
    partCondition: z.enum(['OEM', 'AFTERMARKET', 'USED']).optional(),
    warrantyDays: z.number().int().min(0).default(30),
    etaDescription: z.string().min(2),
    deliveryMethod: z
      .enum(['PICKUP', 'DOORSTEP_DELIVERY', 'PARTS_COURIER', 'ON_SITE_FITMENT'])
      .optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

// Live provider tracking
export const UpdateBookingLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    etaMinutes: z.number().int().min(0).max(24 * 60).optional(),
  })
  .strict();

export const AcceptQuotationSchema = z
  .object({
    scheduledDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Scheduled date must use YYYY-MM-DD')
      .refine(
        (value) =>
          new Date(`${value}T23:59:59.999Z`).getTime() >=
          Date.now() - 24 * 60 * 60 * 1000,
        'Scheduled date cannot be in the past',
      )
      .optional(),
    deliveryAddress: z.string().min(5).max(500).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export const UpdateBookingStatusSchema = z
  .object({
    status: z.enum([
      'CONFIRMED',
      'PROVIDER_EN_ROUTE',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'DISPUTED',
    ]),
    trackingNumber: z.string().optional(),
    carrierName: z.string().optional(),
    completionNotes: z.string().max(1000).optional(),
  })
  .strict();

export const VerifyProviderSchema = z
  .object({
    status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']),
    auditorNotes: z.string().max(1000).optional(),
  })
  .strict();

// Review validation
export const CreateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  })
  .strict();

// Escrow release / payout validation
export const ReleasePaymentSchema = z
  .object({
    bookingId: z.string().uuid(),
    payoutReference: z.string().min(1).max(255),
    notes: z.string().max(1000).optional(),
  })
  .strict();

// Phone OTP validation
export const SendOtpSchema = z
  .object({
    phone: z.string().min(10).max(15),
    purpose: z.enum(['login', 'register', 'reset_password']).default('login'),
  })
  .strict();

export const VerifyOtpSchema = z
  .object({
    phone: z.string().min(10).max(15),
    code: z.string().length(6),
    purpose: z.enum(['login', 'register', 'reset_password']).default('login'),
  })
  .strict();

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type ReleasePaymentInput = z.infer<typeof ReleasePaymentSchema>;
export type SendOtpInput = z.infer<typeof SendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;

// Export inferred types
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;
export type CreateServiceRequestInput = z.infer<typeof CreateServiceRequestSchema>;
export type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;
export type AcceptQuotationInput = z.infer<typeof AcceptQuotationSchema>;
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;
export type UpdateBookingLocationInput = z.infer<typeof UpdateBookingLocationSchema>;
export type VerifyProviderInput = z.infer<typeof VerifyProviderSchema>;
