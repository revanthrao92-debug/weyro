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
  })
  .strict();

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
    vehicleId: z.string().min(1),
    category: z
      .enum([
        'REPAIR',
        'MAINTENANCE',
        'SPARE_PART',
        'TOWING',
        'ROADSIDE',
        'INSPECTION',
      ])
      .default('REPAIR'),
    title: z.string().min(5).max(150),
    description: z.string().min(10).max(2000),
    address: z.string().min(5),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).default('NORMAL'),
    mediaUrls: z.array(z.string().url()).default([]),
    damagePhotos: z.array(z.string()).default([]),
    isBroadcast: z.boolean().default(true),
    fulfillmentType: z
      .enum(['ON_SITE', 'WORKSHOP_VISIT', 'PARTS_SHIPPING', 'TOW_TO_GARAGE'])
      .optional(),
    expiresInDays: z.number().int().min(1).max(30).optional(),
  })
  .strict();

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

export const AcceptQuotationSchema = z
  .object({
    scheduledDate: z.string().optional(),
    deliveryAddress: z.string().optional(),
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

// Export inferred types
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;
export type CreateServiceRequestInput = z.infer<typeof CreateServiceRequestSchema>;
export type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;
export type AcceptQuotationInput = z.infer<typeof AcceptQuotationSchema>;
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;
export type VerifyProviderInput = z.infer<typeof VerifyProviderSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
