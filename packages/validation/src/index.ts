import { z } from 'zod';

// Auth validation
export const RegisterSchema = z.object({
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
});

export const LoginSchema = z.object({
  emailOrPhone: z.string().min(3),
  password: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// Vehicle validation
export const CreateVehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  registrationNumber: z.string().min(4).max(20),
  vinNumber: z.string().optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG']),
  color: z.string().optional(),
});

// Service Request validation
export const CreateServiceRequestSchema = z.object({
  vehicleId: z.string().uuid(),
  category: z.enum([
    'REPAIR',
    'MAINTENANCE',
    'SPARE_PART',
    'TOWING',
    'ROADSIDE',
    'INSPECTION',
  ]),
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
});

// Quotation validation
export const CreateQuotationSchema = z.object({
  requestId: z.string().uuid(),
  partsCost: z.number().min(0),
  labourCost: z.number().min(0),
  shippingCost: z.number().min(0).optional(),
  partCondition: z.enum(['OEM', 'AFTERMARKET', 'USED']).optional(),
  warrantyDays: z.number().int().min(0).default(30),
  etaDescription: z.string().min(2),
  deliveryMethod: z
    .enum(['PICKUP', 'DOORSTEP_DELIVERY', 'PARTS_COURIER', 'ON_SITE_FITMENT'])
    .optional(),
  notes: z.string().max(1000).optional(),
});

// Review validation
export const CreateReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// Export inferred types
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;
export type CreateServiceRequestInput = z.infer<typeof CreateServiceRequestSchema>;
export type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
