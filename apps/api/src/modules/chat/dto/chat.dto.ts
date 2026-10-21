import { z } from 'zod';

export const createThreadSchema = z
  .object({
    requestId: z.string().uuid().optional(),
    providerId: z.string().uuid(),
  })
  .strict();

export type CreateThreadDto = z.infer<typeof createThreadSchema>;

export const sendMessageSchema = z
  .object({
    content: z.string().min(1).max(2000),
    mediaUrls: z.array(z.string().url()).default([]),
  })
  .strict();

export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export const markReadSchema = z
  .object({
    messageIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export type MarkReadDto = z.infer<typeof markReadSchema>;
