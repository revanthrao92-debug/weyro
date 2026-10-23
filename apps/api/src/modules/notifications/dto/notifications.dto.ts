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

export const deletePushTokenSchema = z
  .object({
    token: z.string().min(10),
  })
  .strict();

export class DeletePushTokenDto
  implements z.infer<typeof deletePushTokenSchema>
{
  static readonly schema = deletePushTokenSchema;

  token!: string;
}
