import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

describe('ChatService', () => {
  let service: ChatService;
  let mockPrisma: any;
  let mockNotifications: jest.Mocked<NotificationsService>;

  beforeEach(() => {
    mockPrisma = {
      thread: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockNotifications = {
      sendPushNotification: jest.fn().mockResolvedValue({} as any),
    } as any;

    service = new ChatService(mockPrisma, mockNotifications);
  });

  const customerUser: AuthUserPayload = {
    sub: 'user-c',
    email: 'c@test.com',
    phone: '+919876543210',
    role: 'CUSTOMER',
    customerProfileId: 'cust-1',
  };

  const providerUser: AuthUserPayload = {
    sub: 'user-p',
    email: 'p@test.com',
    phone: '+919876543211',
    role: 'PROVIDER',
    providerProfileId: 'prov-1',
  };

  const intruderUser: AuthUserPayload = {
    sub: 'user-x',
    email: 'x@test.com',
    phone: '+919876543212',
    role: 'CUSTOMER',
    customerProfileId: 'cust-999',
  };

  describe('getOrCreateThread', () => {
    it('throws ForbiddenException if non-admin has no customerProfileId', async () => {
      await expect(
        service.getOrCreateThread(
          { sub: 'user-no-cust', email: 'a@b.com', phone: '+919876543213', role: 'PROVIDER' },
          { providerId: 'prov-1' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns existing thread if present', async () => {
      mockPrisma.thread.findFirst.mockResolvedValue({ id: 'thread-1' });

      const result = await service.getOrCreateThread(customerUser, {
        providerId: 'prov-1',
      });

      expect(result).toEqual({ id: 'thread-1' });
      expect(mockPrisma.thread.create).not.toHaveBeenCalled();
    });

    it('creates new thread if none exists', async () => {
      mockPrisma.thread.findFirst.mockResolvedValue(null);
      mockPrisma.thread.create.mockResolvedValue({
        id: 'new-thread',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      const result = await service.getOrCreateThread(customerUser, {
        providerId: 'prov-1',
      });

      expect(result.id).toBe('new-thread');
      expect(mockPrisma.thread.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            providerId: 'prov-1',
          }),
        }),
      );
    });
  });

  describe('verifyParticipant', () => {
    it('throws NotFoundException if thread does not exist', async () => {
      mockPrisma.thread.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyParticipant('non-existent', customerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user is not customer or provider in the thread', async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: 't-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        customer: { userId: 'user-c', firstName: 'A', lastName: 'B' },
        provider: { userId: 'user-p', businessName: 'AutoFix' },
      });

      await expect(
        service.verifyParticipant('t-1', intruderUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows verified customer participant', async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: 't-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        customer: { userId: 'user-c', firstName: 'A', lastName: 'B' },
        provider: { userId: 'user-p', businessName: 'AutoFix' },
      });

      const thread = await service.verifyParticipant('t-1', customerUser);
      expect(thread.id).toBe('t-1');
    });

    it('allows verified provider participant', async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: 't-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        customer: { userId: 'user-c', firstName: 'A', lastName: 'B' },
        provider: { userId: 'user-p', businessName: 'AutoFix' },
      });

      const thread = await service.verifyParticipant('t-1', providerUser);
      expect(thread.id).toBe('t-1');
    });
  });

  describe('sendMessage', () => {
    it('creates message, updates lastMessageAt, and sends push notification to recipient', async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: 't-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        customer: { userId: 'user-c', firstName: 'A', lastName: 'B' },
        provider: { userId: 'user-p', businessName: 'AutoFix' },
      });

      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        threadId: 't-1',
        content: 'Hello provider!',
        senderId: 'user-c',
      });

      const message = await service.sendMessage(
        't-1',
        customerUser,
        'Hello provider!',
      );

      expect(message.id).toBe('msg-1');
      expect(mockPrisma.thread.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { lastMessageAt: expect.any(Date) },
      });
      expect(mockNotifications.sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-p',
          title: 'New message from A B',
          body: 'Hello provider!',
        }),
      );
    });
  });

  describe('markMessagesRead', () => {
    it('marks unread messages not sent by current user as read', async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: 't-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        customer: { userId: 'user-c', firstName: 'A', lastName: 'B' },
        provider: { userId: 'user-p', businessName: 'AutoFix' },
      });

      mockPrisma.message.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markMessagesRead('t-1', customerUser);

      expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          threadId: 't-1',
          senderId: { not: 'user-c' },
          readAt: null,
        },
        data: { readAt: expect.any(Date) },
      });
      expect(result).toEqual({ count: 2 });
    });
  });
});
