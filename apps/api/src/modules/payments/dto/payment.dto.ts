import { z } from 'zod';

export const createOrderSchema = z
  .object({
    bookingId: z.string().uuid(),
  })
  .strict();

export type CreateOrderDto = z.infer<typeof createOrderSchema>;

export const verifyPaymentSchema = z
  .object({
    bookingId: z.string().uuid(),
    orderId: z.string().min(1),
    paymentId: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

export type VerifyPaymentDto = z.infer<typeof verifyPaymentSchema>;
