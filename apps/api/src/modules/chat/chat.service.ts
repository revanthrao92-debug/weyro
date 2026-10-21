import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { CreateThreadDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getOrCreateThread(user: AuthUserPayload, dto: CreateThreadDto) {
    if (!user.customerProfileId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Customer profile required to initiate chat thread',
      );
    }
    const customerId = user.customerProfileId || user.sub;

    const existing = await this.prisma.thread.findFirst({
      where: {
        customerId,
        providerId: dto.providerId,
        requestId: dto.requestId || null,
      },
      include: {
        customer: true,
        provider: true,
        request: true,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.thread.create({
      data: {
        customerId,
        providerId: dto.providerId,
        requestId: dto.requestId,
      },
      include: {
        customer: true,
        provider: true,
        request: true,
      },
    });
  }

  async getUserThreads(
    user: AuthUserPayload,
    cursor?: string,
    limit: number = 20,
  ) {
    const boundedLimit = Math.min(50, Math.max(1, limit));
    const where: any = {};

    if (user.role === 'ADMIN') {
      // admin sees all
    } else if (user.customerProfileId && user.role === 'CUSTOMER') {
      where.customerId = user.customerProfileId;
    } else if (user.providerProfileId && user.role === 'PROVIDER') {
      where.providerId = user.providerProfileId;
    } else if (user.role === 'BOTH') {
      where.OR = [
        user.customerProfileId
          ? { customerId: user.customerProfileId }
          : undefined,
        user.providerProfileId
          ? { providerId: user.providerProfileId }
          : undefined,
      ].filter(Boolean);
    } else {
      where.id = 'none';
    }

    const items = await this.prisma.thread.findMany({
      where,
      take: boundedLimit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        provider: {
          select: { id: true, businessName: true, phone: true },
        },
        request: {
          select: { id: true, title: true, status: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return {
      items,
      nextCursor:
        items.length === boundedLimit ? items[items.length - 1].id : null,
    };
  }

  async verifyParticipant(threadId: string, user: AuthUserPayload) {
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        customer: {
          select: { id: true, userId: true, firstName: true, lastName: true },
        },
        provider: { select: { id: true, userId: true, businessName: true } },
      },
    });

    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const isCustomer =
      user.customerProfileId && thread.customerId === user.customerProfileId;
    const isProvider =
      user.providerProfileId && thread.providerId === user.providerProfileId;
    const isAdmin = user.role === 'ADMIN';

    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ForbiddenException(
        'You are not a participant in this chat thread',
      );
    }

    return thread;
  }

  async getThreadMessages(
    threadId: string,
    user: AuthUserPayload,
    cursor?: string,
    limit: number = 30,
  ) {
    await this.verifyParticipant(threadId, user);
    const boundedLimit = Math.min(50, Math.max(1, limit));

    const items = await this.prisma.message.findMany({
      where: { threadId },
      take: boundedLimit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: items.reverse(), // chronological order
      nextCursor: items.length === boundedLimit ? items[0].id : null,
    };
  }

  async sendMessage(
    threadId: string,
    user: AuthUserPayload,
    content: string,
    mediaUrls: string[] = [],
  ) {
    const thread = await this.verifyParticipant(threadId, user);

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          threadId,
          senderId: user.sub,
          senderRole: user.role,
          content,
          mediaUrls,
        },
      });

      await tx.thread.update({
        where: { id: threadId },
        data: { lastMessageAt: new Date() },
      });

      return msg;
    });

    // Notify the other participant via push notification
    const recipientUserId =
      user.sub === thread.customer.userId
        ? thread.provider.userId
        : thread.customer.userId;

    const senderName =
      user.sub === thread.customer.userId
        ? `${thread.customer.firstName} ${thread.customer.lastName}`
        : thread.provider.businessName;

    this.notifications
      .sendPushNotification({
        userId: recipientUserId,
        title: `New message from ${senderName}`,
        body: content.length > 80 ? `${content.slice(0, 77)}...` : content,
        data: { threadId, messageId: message.id, type: 'chat_message' },
      })
      .catch(() => {});

    return message;
  }

  async markMessagesRead(
    threadId: string,
    user: AuthUserPayload,
    messageIds?: string[],
  ) {
    await this.verifyParticipant(threadId, user);

    const where: any = {
      threadId,
      senderId: { not: user.sub },
      readAt: null,
    };

    if (messageIds && messageIds.length > 0) {
      where.id = { in: messageIds };
    }

    return this.prisma.message.updateMany({
      where,
      data: { readAt: new Date() },
    });
  }
}
