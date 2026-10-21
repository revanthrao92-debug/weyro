import { z } from 'zod';

export const registerPushTokenSchema = z
  .object({
    token: z.string().min(10),
    deviceOs: z.enum(['ios', 'android', 'web']).optional(),
  })
  .strict();

export class RegisterPushTokenDto
  implements z.infer<typeof registerPushTokenSchema>
{
  static readonly schema = registerPushTokenSchema;

  token!: string;
  deviceOs?: 'ios' | 'android' | 'web';
}
