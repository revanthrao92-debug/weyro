import { z } from 'zod';

export const createOrderSchema = z
  .object({
    bookingId: z.string().uuid(),
  })
  .strict();

export class CreateOrderDto implements z.infer<typeof createOrderSchema> {
  static readonly schema = createOrderSchema;

  bookingId!: string;
}

export const verifyPaymentSchema = z
  .object({
    bookingId: z.string().uuid(),
    orderId: z.string().min(1),
    paymentId: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

export class VerifyPaymentDto implements z.infer<typeof verifyPaymentSchema> {
  static readonly schema = verifyPaymentSchema;

  bookingId!: string;
  orderId!: string;
  paymentId!: string;
  signature!: string;
}
