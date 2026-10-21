import { z } from 'zod';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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
    fileSize: z
      .number()
      .int()
      .positive()
      .max(MAX_FILE_SIZE, `File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)} MB`)
      .optional(),
  })
  .strict();

export type PresignedUrlQueryDto = z.infer<typeof presignedUrlQuerySchema>;
