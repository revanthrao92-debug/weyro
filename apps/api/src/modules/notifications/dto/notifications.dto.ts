import { z } from 'zod';

export const registerPushTokenSchema = z
  .object({
    token: z.string().min(10),
    deviceOs: z.enum(['ios', 'android', 'web']).optional(),
  })
  .strict();

export type RegisterPushTokenDto = z.infer<typeof registerPushTokenSchema>;
