import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { env } from '../../config/env.config';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { PrismaService } from '../../prisma/prisma.service';

const allowedOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const joinBookingSchema = z
  .object({ bookingId: z.string().min(1) })
  .strict();

export interface BookingLocationPayload {
  latitude: number;
  longitude: number;
  etaMinutes: number | null;
  updatedAt: string;
}

@WebSocketGateway({
  cors:
    allowedOrigins.includes('*')
      ? { origin: '*' }
      : {
          origin: (
            origin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void,
          ) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              callback(
                new Error(`Origin ${origin} is not allowed by CORS policy`),
              );
            }
          },
        },
  namespace: '/tracking',
  maxHttpBufferSize: 16 * 1024,
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
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
    } catch (err: any) {
      this.logger.warn(`Tracking socket unauthorized: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Tracking socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_booking')
  async handleJoinBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const user: AuthUserPayload = client.data.user;
    if (!user) return { error: 'Unauthorized' };

    const parsed = joinBookingSchema.safeParse(data);
    if (!parsed.success) return { error: 'Invalid payload' };

    const booking = await this.prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: { customerId: true, providerId: true },
    });

    if (!booking) return { error: 'Booking not found' };

    const canAccess =
      user.role === 'ADMIN' ||
      (user.customerProfileId &&
        user.customerProfileId === booking.customerId) ||
      (user.providerProfileId && user.providerProfileId === booking.providerId);

    if (!canAccess) return { error: 'Forbidden' };

    const room = `booking_${parsed.data.bookingId}`;
    client.join(room);
    return { status: 'joined', bookingId: parsed.data.bookingId };
  }

  emitLocation(bookingId: string, payload: BookingLocationPayload) {
    this.server?.to(`booking_${bookingId}`).emit('booking_location', {
      bookingId,
      ...payload,
    });
  }

  emitStatus(bookingId: string, status: string) {
    this.server?.to(`booking_${bookingId}`).emit('booking_status', {
      bookingId,
      status,
    });
  }
}
