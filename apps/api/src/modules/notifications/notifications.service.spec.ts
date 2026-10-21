const mockSendPushNotificationsAsync = jest.fn();
const mockChunkPushNotifications = jest.fn((messages: any[]) => [messages]);
const mockIsExpoPushToken = jest.fn(
  (token: string) =>
    typeof token === 'string' && token.startsWith('ExponentPushToken['),
);

jest.mock('expo-server-sdk', () => {
  class MockExpo {
    static isExpoPushToken = mockIsExpoPushToken;
    sendPushNotificationsAsync = mockSendPushNotificationsAsync;
    chunkPushNotifications = mockChunkPushNotifications;
  }
  return {
    Expo: MockExpo,
  };
});

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      pushToken: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    service = new NotificationsService(mockPrisma);
  });

  describe('registerPushToken', () => {
    it('ignores invalid expo push token strings', async () => {
      const result = await service.registerPushToken('user-1', {
        token: 'invalid-token-123',
        deviceOs: 'ios',
      });

      expect(result).toEqual({ status: 'ignored', reason: 'invalid_format' });
      expect(mockPrisma.pushToken.upsert).not.toHaveBeenCalled();
    });

    it('upserts valid expo push token for user', async () => {
      const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      mockPrisma.pushToken.upsert.mockResolvedValue({
        id: 'pt-1',
        userId: 'user-1',
        token: validToken,
      });

      const result = await service.registerPushToken('user-1', {
        token: validToken,
        deviceOs: 'android',
      });

      expect(result).toHaveProperty('id', 'pt-1');
      expect(mockPrisma.pushToken.upsert).toHaveBeenCalledWith({
        where: { token: validToken },
        update: {
          userId: 'user-1',
          deviceOs: 'android',
          updatedAt: expect.any(Date),
        },
        create: {
          userId: 'user-1',
          token: validToken,
          deviceOs: 'android',
        },
      });
    });
  });

  describe('sendPushNotification', () => {
    it('always creates an in-app notification in database', async () => {
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        title: 'Test',
        body: 'Message',
      });
      mockPrisma.pushToken.findMany.mockResolvedValue([]);

      const result = await service.sendPushNotification({
        userId: 'user-1',
        title: 'Test',
        body: 'Message',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          title: 'Test',
          body: 'Message',
          data: {},
        },
      });
      expect(result.sentPushCount).toBe(0);
    });

    it('sends push notification if user has registered expo push tokens', async () => {
      const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        title: 'Test',
        body: 'Message',
      });
      mockPrisma.pushToken.findMany.mockResolvedValue([
        { token: validToken, deviceOs: 'ios' },
      ]);

      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok', id: 'ticket-1' },
      ]);

      const result = await service.sendPushNotification({
        userId: 'user-1',
        title: 'Hello',
        body: 'World',
        data: { test: true },
      });

      expect(mockSendPushNotificationsAsync).toHaveBeenCalled();
      expect(result.sentPushCount).toBe(1);
    });

    it('purges token when Expo returns DeviceNotRegistered error', async () => {
      const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
      mockPrisma.pushToken.findMany.mockResolvedValue([
        { token: validToken, deviceOs: 'android' },
      ]);

      mockSendPushNotificationsAsync.mockResolvedValue([
        {
          status: 'error',
          message: 'Device not registered',
          details: { error: 'DeviceNotRegistered' },
        },
      ]);

      await service.sendPushNotification({
        userId: 'user-1',
        title: 'Hello',
        body: 'World',
      });

      expect(mockPrisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { token: validToken },
      });
    });
  });

  describe('getUserNotifications', () => {
    it('returns cursor-paginated notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        { id: 'notif-1', title: 'N1' },
        { id: 'notif-2', title: 'N2' },
      ]);

      const result = await service.getUserNotifications('user-1', undefined, 2);

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('notif-2');
    });
  });

  describe('markAsRead', () => {
    it('updates readAt timestamp for user notifications', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsRead('user-1', 'notif-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
