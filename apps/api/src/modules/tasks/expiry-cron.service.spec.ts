import { ExpiryCronService } from './expiry-cron.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvisoryLockService } from '../../prisma/advisory-lock.service';

describe('ExpiryCronService', () => {
  const build = (locked: boolean) => {
    const prisma = {
      serviceRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      quotation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const lock = {
      tryLock: jest.fn().mockResolvedValue(locked),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ExpiryCronService(
      prisma as unknown as PrismaService,
      lock as unknown as AdvisoryLockService,
    );
    return { service, prisma, lock };
  };

  it('skips the run when another replica holds the lock', async () => {
    const { service, prisma, lock } = build(false);
    await service.handleExpiration();
    expect(prisma.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(lock.release).not.toHaveBeenCalled();
  });

  it('runs and releases the lock when it gets it', async () => {
    const { service, prisma, lock } = build(true);
    await service.handleExpiration();
    expect(prisma.serviceRequest.updateMany).toHaveBeenCalled();
    expect(prisma.quotation.updateMany).toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalledWith('expiry');
  });

  it('releases the lock even when the update fails', async () => {
    const { service, prisma, lock } = build(true);
    prisma.serviceRequest.updateMany.mockRejectedValue(new Error('db down'));
    await service.handleExpiration();
    expect(lock.release).toHaveBeenCalledWith('expiry');
  });
});
