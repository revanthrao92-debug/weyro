import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { RegisterPushTokenDto } from './dto/notifications.dto';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    if (!Expo.isExpoPushToken(dto.token)) {
      this.logger.warn(`Invalid Expo push token received: ${dto.token}`);
      return { status: 'ignored', reason: 'invalid_format' };
    }

    const tokenRecord = await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        deviceOs: dto.deviceOs,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        deviceOs: dto.deviceOs,
      },
    });

    return tokenRecord;
  }

  async sendPushNotification(params: {
    userId: string;
    title: string;
    body: string;
    data?: any;
  }) {
    const { userId, title, body, data } = params;

    // 1. Save in-app notification in database
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        data: data || {},
      },
    });

    // 2. Fetch user's registered push tokens
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
    });

    if (tokens.length === 0) {
      return { notification, sentPushCount: 0 };
    }

    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.token));
    if (validTokens.length === 0) {
      return { notification, sentPushCount: 0 };
    }

    const messages: ExpoPushMessage[] = validTokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        ticketChunk.forEach(async (ticket, index) => {
          if (ticket.status === 'error') {
            this.logger.error(
              `Error sending push notification: ${ticket.message}`,
            );
            if (
              ticket.details &&
              ticket.details.error === 'DeviceNotRegistered'
            ) {
              const invalidToken = chunk[index].to as string;
              this.logger.log(
                `Purging unregistered device token: ${invalidToken}`,
              );
              await this.prisma.pushToken.deleteMany({
                where: { token: invalidToken },
              });
            }
          }
        });
      } catch (err: any) {
        this.logger.error(`Push dispatch error: ${err.message}`);
      }
    }

    return { notification, sentPushCount: validTokens.length };
  }

  async getUserNotifications(
    userId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    const boundedLimit = Math.min(50, Math.max(1, limit));
    const cursorTuple = cursor ? decodeCursor(cursor) : null;

    const items = await this.prisma.notification.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        userId,
      },
      take: boundedLimit,
      orderBy: { createdAt: 'desc', id: 'desc' },
    });

    return {
      items,
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }
}
