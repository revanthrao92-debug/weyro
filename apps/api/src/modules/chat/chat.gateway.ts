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
import { ChatService } from './chat.service';
import { env } from '../../config/env.config';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

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
import { ChatService } from './chat.service';
import { env } from '../../config/env.config';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

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
    @MessageBody() data: { threadId: string },
  ) {
    const user: AuthUserPayload = client.data.user;
    if (!user || !data.threadId) {
      return { error: 'Unauthorized or missing threadId' };
    }

    try {
      await this.chatService.verifyParticipant(data.threadId, user);
      client.join(`thread_${data.threadId}`);
      return { status: 'joined', threadId: data.threadId };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { threadId: string; content: string; mediaUrls?: string[] },
  ) {
    const user: AuthUserPayload = client.data.user;
    if (!user || !data.threadId || !data.content) {
      return { error: 'Invalid payload' };
    }

    try {
      const message = await this.chatService.sendMessage(
        data.threadId,
        user,
        data.content,
        data.mediaUrls || [],
      );

      this.server
        .to(`thread_${data.threadId}`)
        .emit('new_message', { threadId: data.threadId, message });

      return { status: 'sent', message };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string; messageIds?: string[] },
  ) {
    const user: AuthUserPayload = client.data.user;
    if (!user || !data.threadId) {
      return { error: 'Invalid payload' };
    }

    try {
      await this.chatService.markMessagesRead(
        data.threadId,
        user,
        data.messageIds,
      );

      this.server.to(`thread_${data.threadId}`).emit('messages_read', {
        threadId: data.threadId,
        userId: user.sub,
        messageIds: data.messageIds,
      });

      return { status: 'read' };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
