import { z } from 'zod';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const presignedUrlQuerySchema = z
  .object({
    filename: z.string().min(1).max(255),
    contentType: z.enum(ALLOWED_MIME_TYPES, {
      errorMap: () => ({
        message:
          'Invalid content type. Allowed types: image/jpeg, image/png, image/webp, image/heic',
      }),
    }),
    folder: z
      .enum(['damage-requests', 'vehicles', 'avatars', 'spare-parts'])
      .default('damage-requests'),
  })
  .strict();

export type PresignedUrlQueryDto = z.infer<typeof presignedUrlQuerySchema>;
