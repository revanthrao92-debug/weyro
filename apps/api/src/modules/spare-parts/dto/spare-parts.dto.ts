import { z } from 'zod';

export const createSparePartSchema = z
  .object({
    name: z.string().min(2).max(100),
    partNumber: z.string().min(2).max(50),
    compatibleMakes: z.array(z.string()).default([]),
    compatibleModels: z.array(z.string()).default([]),
    condition: z.enum(['OEM', 'AFTERMARKET', 'USED']).default('AFTERMARKET'),
    price: z.number().positive(),
    stockQuantity: z.number().int().min(0).default(1),
    imageUrl: z.string().url().optional(),
    kind: z.enum(['PART', 'PACKAGE']).default('PART'),
    description: z.string().max(500).optional(),
    estimatedMinutes: z.number().int().min(15).max(480).optional(),
  })
  .strict();

export class CreateSparePartDto implements z.infer<typeof createSparePartSchema> {
  static readonly schema = createSparePartSchema;

  name!: string;
  partNumber!: string;
  compatibleMakes!: string[];
  compatibleModels!: string[];
  condition!: 'OEM' | 'AFTERMARKET' | 'USED';
  price!: number;
  stockQuantity!: number;
  imageUrl?: string;
  kind!: 'PART' | 'PACKAGE';
  description?: string;
  estimatedMinutes?: number;
}

export const updateSparePartSchema = createSparePartSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export class UpdateSparePartDto implements z.infer<typeof updateSparePartSchema> {
  static readonly schema = updateSparePartSchema;

  name?: string;
  partNumber?: string;
  compatibleMakes?: string[];
  compatibleModels?: string[];
  condition?: 'OEM' | 'AFTERMARKET' | 'USED';
  price?: number;
  stockQuantity?: number;
  imageUrl?: string;
  kind?: 'PART' | 'PACKAGE';
  description?: string;
  estimatedMinutes?: number;
  isActive?: boolean;
}

export const createSparePartOrderSchema = z
  .object({
    quantity: z.number().int().min(1).max(10).default(1),
    shippingName: z.string().min(1).max(120).optional(),
    shippingPhone: z.string().min(8).max(20).optional(),
    shippingAddress: z.string().min(5).max(500).optional(),
    shippingCity: z.string().min(2).max(100).optional(),
    shippingPincode: z.string().min(4).max(12).optional(),
  })
  .strict();

export class CreateSparePartOrderDto
  implements z.infer<typeof createSparePartOrderSchema>
{
  static readonly schema = createSparePartOrderSchema;

  quantity!: number;
  shippingName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingPincode?: string;
}

export const verifySparePartOrderSchema = z
  .object({
    razorpayOrderId: z.string().min(1).max(100),
    razorpayPaymentId: z.string().min(1).max(100),
    razorpaySignature: z.string().min(10).max(256),
  })
  .strict();

export class VerifySparePartOrderDto
  implements z.infer<typeof verifySparePartOrderSchema>
{
  static readonly schema = verifySparePartOrderSchema;

  razorpayOrderId!: string;
  razorpayPaymentId!: string;
  razorpaySignature!: string;
}


export const updateFulfillmentSchema = z
  .object({
    status: z.enum(['PROCESSING', 'READY', 'SHIPPED', 'DELIVERED']),
    carrierName: z.string().min(1).max(100).optional(),
    trackingNumber: z.string().min(1).max(120).optional(),
    dealerNotes: z.string().max(500).optional(),
  })
  .strict();

export type UpdateFulfillmentInput = z.infer<typeof updateFulfillmentSchema>;

export class UpdateFulfillmentDto implements UpdateFulfillmentInput {
  static readonly schema = updateFulfillmentSchema;

  status!: 'PROCESSING' | 'READY' | 'SHIPPED' | 'DELIVERED';
  carrierName?: string;
  trackingNumber?: string;
  dealerNotes?: string;
}
