import { NotificationsService } from './notifications.service';

/** H4 remediation: push tokens cannot be stolen across users. */
describe('NotificationsService.registerPushToken – H4', () => {
  let service: NotificationsService;
  let mockPrisma: any;

  const TOKEN = 'ExponentPushToken[aabbccddeeff0011223344]';

  beforeEach(() => {
    mockPrisma = {
      pushToken: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
    };
    service = new NotificationsService(mockPrisma);
  });

  const dto = { token: TOKEN, deviceOs: 'ios' };

  it('allows a user to register their own token (initial create)', async () => {
    mockPrisma.pushToken.findUnique.mockResolvedValue(null);
    mockPrisma.pushToken.upsert.mockImplementation(async ({ where, create }: any) => ({
      token: where.token,
      ...create,
    }));

    const res = await service.registerPushToken('user-1', dto as any);

    expect(res.status).toBeUndefined(); // returns the token record
    expect(mockPrisma.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: TOKEN },
        create: { userId: 'user-1', token: TOKEN, deviceOs: 'ios' },
      }),
    );
  });

  it('re-registers by the same owner (update path, keeps binding)', async () => {
    mockPrisma.pushToken.findUnique.mockResolvedValue({
      token: TOKEN,
      userId: 'user-1',
    });

    await service.registerPushToken('user-1', dto as any);

    expect(mockPrisma.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: TOKEN },
        update: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('ignores a cross-user claim of an existing token (no silent theft)', async () => {
    mockPrisma.pushToken.findUnique.mockResolvedValue({
      token: TOKEN,
      userId: 'user-victim',
    });

    const res = await service.registerPushToken('user-attacker', dto as any);

    expect(res).toEqual({ status: 'ignored', reason: 'owned_by_other' });
    expect(mockPrisma.pushToken.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.pushToken.deleteMany).not.toHaveBeenCalled();
  });

  it('caps tokens per user (drops oldest beyond MAX_TOKENS_PER_USER)', async () => {
    mockPrisma.pushToken.findUnique.mockResolvedValue(null);
    // 5 existing tokens = the cap; a 6th registration should evict the oldest.
    const oldest = { token: 'ExponentPushToken[0000000000000000000000000000000000000000]' };
    mockPrisma.pushToken.findMany.mockResolvedValue([
      oldest,
      { token: 'ExpoPushToken[0011]' },
      { token: 'ExpoPushToken[0022]' },
      { token: 'ExpoPushToken[0033]' },
      { token: 'ExpoPushToken[0044]' },
    ]);

    await service.registerPushToken('user-1', dto as any);

    expect(mockPrisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: [oldest.token] } },
    });
  });
});
