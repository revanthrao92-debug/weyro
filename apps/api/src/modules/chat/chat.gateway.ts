import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { ChatService } from './chat.service';
import { env } from '../../config/env.config';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

const joinThreadSchema = z
  .object({ threadId: z.string().uuid() })
  .strict();

const socketSendMessageSchema = z
  .object({
    threadId: z.string().uuid(),
    content: z.string().min(1).max(2000),
    mediaUrls: z.array(z.string().url()).max(4).default([]),
  })
  .strict();

const socketMarkReadSchema = z
  .object({
    threadId: z.string().uuid(),
    messageIds: z.array(z.string().uuid()).max(100).optional(),
  })
  .strict();

const SOCKET_SEND_LIMIT = 30;
const SOCKET_SEND_WINDOW_MS = 60_000;

@WebSocketGateway({
  cors:
    allowedOrigins.includes('*')
      ? { origin: '*' }
      : {
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
            }
          },
        },
  namespace: '/chat',
  maxHttpBufferSize: 64 * 1024,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader =
        client.handshake.headers.authorization ||
        (client.handshake.auth?.token as string);

      if (!authHeader) {
        client.disconnect();
        return;
      }

      const token = authHeader.replace(/^Bearer\s+/i, '');
      const payload: AuthUserPayload = this.jwtService.verify(token, {
        secret: env.JWT_ACCESS_SECRET,
      });

      client.data.user = payload;
      this.logger.log(
        `WebSocket client connected: ${client.id} (user: ${payload.sub})`,
      );
    } catch (err: any) {
      this.logger.warn(`WebSocket connection unauthorized: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WebSocket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_thread')
  async handleJoinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const parsed = joinThreadSchema.safeParse(data);
    if (!parsed.success) {
      return { error: 'Invalid payload' };
    }

    const user: AuthUserPayload = client.data.user;
    if (!user) {
      return { error: 'Unauthorized' };
    }

    try {
      await this.chatService.verifyParticipant(parsed.data.threadId, user);
      client.join(`thread_${parsed.data.threadId}`);
      return { status: 'joined', threadId: parsed.data.threadId };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const user: AuthUserPayload = client.data.user;
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const now = Date.now();
    const recentSends: number[] = (client.data.sendTimestamps || []).filter(
      (timestamp: number) => now - timestamp < SOCKET_SEND_WINDOW_MS,
    );
    if (recentSends.length >= SOCKET_SEND_LIMIT) {
      return { error: 'Rate limit exceeded' };
    }
    recentSends.push(now);
    client.data.sendTimestamps = recentSends;

    const parsed = socketSendMessageSchema.safeParse(data);
    if (!parsed.success) {
      return { error: 'Invalid payload' };
    }

    const { threadId, content, mediaUrls } = parsed.data;

    try {
      const message = await this.chatService.sendMessage(
        threadId,
        user,
        content,
        mediaUrls,
      );

      this.server
        .to(`thread_${threadId}`)
        .emit('new_message', { threadId, message });

      return { status: 'sent', message };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const user: AuthUserPayload = client.data.user;
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const parsed = socketMarkReadSchema.safeParse(data);
    if (!parsed.success) {
      return { error: 'Invalid payload' };
    }

    const { threadId, messageIds } = parsed.data;

    try {
      await this.chatService.markMessagesRead(threadId, user, messageIds);

      this.server.to(`thread_${threadId}`).emit('messages_read', {
        threadId,
        userId: user.sub,
        messageIds,
      });

      return { status: 'read' };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
