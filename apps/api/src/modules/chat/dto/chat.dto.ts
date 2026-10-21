import { z } from 'zod';

export const createThreadSchema = z
  .object({
    requestId: z.string().uuid().optional(),
    providerId: z.string().uuid(),
  })
  .strict();

export class CreateThreadDto implements z.infer<typeof createThreadSchema> {
  static readonly schema = createThreadSchema;

  requestId?: string;
  providerId!: string;
}

export const sendMessageSchema = z
  .object({
    content: z.string().min(1).max(2000),
    mediaUrls: z.array(z.string().url()).default([]),
  })
  .strict();

export class SendMessageDto implements z.infer<typeof sendMessageSchema> {
  static readonly schema = sendMessageSchema;

  content!: string;
  mediaUrls!: string[];
}

export const markReadSchema = z
  .object({
    messageIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export class MarkReadDto implements z.infer<typeof markReadSchema> {
  static readonly schema = markReadSchema;

  messageIds?: string[];
}
