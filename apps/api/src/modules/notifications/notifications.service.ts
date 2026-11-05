import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { OutboxDeliverer } from './outbox.service';
import { RegisterPushTokenDto } from './dto/notifications.dto';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';

/** Mask a push token for safe log lines (Expo tokens are ~40+ chars). */
function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * STEP 5 outbox deliverer: an outbox row becomes an in-app notification
   * + push fan-out through the standard (validation-safe) pipeline.
   */
  public deliverOutboxRow: OutboxDeliverer = (event) => {
    const payload = event.payload as {
      userId?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    };
    if (!payload?.userId) {
      // In-app rows require a user; nothing plausible to deliver
      return Promise.resolve();
    }
    return this.sendPushNotification({
      userId: payload.userId,
      title: payload.title ?? 'Weyro',
      body: payload.body ?? '',
      data: payload.data,
    }) as unknown as Promise<void>;
  };

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    if (!Expo.isExpoPushToken(dto.token)) {
      // Never log the raw token (it is a delivery credential).
      const raw = String(dto.token ?? '');
      this.logger.warn(`Invalid Expo push token received (len=${raw.length})`);
      return { status: 'ignored', reason: 'invalid_format' };
    }

    const existing = await this.prisma.pushToken.findUnique({
      where: { token: dto.token },
    });

    // H4: a push token is a delivery credential. Do NOT let an arbitrary
    // authenticated caller silently steal a device binding owned by someone
    // else. Legitimate re-registration by the same user is the common case;
    // cross-user claims are ignored (and surfaced in logs, token masked).
    if (existing && existing.userId !== userId) {
      this.logger.warn(
        `Push token ${maskToken(dto.token)} already bound to another user — registration ignored (authUserId=${userId})`,
      );
      return { status: 'ignored', reason: 'owned_by_other' };
    }

    // Cap tokens per user (multi-device support with a sane limit): drop the
    // oldest beyond MAX_TOKENS_PER_USER, then upsert.
    const MAX_TOKENS_PER_USER = 5;
    const userTokens = await this.prisma.pushToken.findMany({
      where: { userId },
      orderBy: { updatedAt: 'asc' },
    });
    const isUpdate = !!existing;
    const overflow = userTokens.length + (isUpdate ? 0 : 1) - MAX_TOKENS_PER_USER;
    if (overflow > 0) {
      const stale = userTokens.slice(0, overflow);
      await this.prisma.pushToken.deleteMany({
        where: { token: { in: stale.map((t) => t.token) } },
      });
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
        deletedAt: null,
      },
      take: boundedLimit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null, deletedAt: null },
    });
    return { unreadCount };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, deletedAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async deletePushToken(userId: string, token: string) {
    const result = await this.prisma.pushToken.deleteMany({
      where: { userId, token },
    });
    return { deleted: result.count };
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId, deletedAt: null },
      data: { readAt: new Date() },
    });
  }
}
