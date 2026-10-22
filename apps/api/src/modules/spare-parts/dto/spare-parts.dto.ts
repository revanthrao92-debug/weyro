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
}

export const createSparePartOrderSchema = z
  .object({
    quantity: z.number().int().min(1).max(10).default(1),
  })
  .strict();

export class CreateSparePartOrderDto
  implements z.infer<typeof createSparePartOrderSchema>
{
  static readonly schema = createSparePartOrderSchema;

  quantity!: number;
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
