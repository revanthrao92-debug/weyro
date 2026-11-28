import { DriverGoService } from './driver-go.service';
import { istDayStart, istMonthStart, istWeekStart } from '../../common/utils/ist-day';

describe('driver earnings totals', () => {
  it('sum every completed trip in the period, not just the latest 100 shown in the list', async () => {
    // 150 trips of ₹200 inside this Indian month (pinned to its start so the test
    // can't straddle a month boundary); the list query returns only 100 of them.
    const monthStart = istMonthStart().getTime();
    const trips = Array.from({ length: 150 }, (_, i) => ({ completedAt: new Date(monthStart + (150 - i) * 1000), driverEarning: 200 }));
    const prisma = {
      driverBooking: {
        findMany: jest.fn().mockResolvedValue(trips.slice(0, 100)),
        aggregate: jest.fn().mockImplementation(async ({ where }: any) => ({
          _sum: {
            driverEarning: trips
              .filter((t) => t.completedAt >= where.completedAt.gte)
              .reduce((s, t) => s + t.driverEarning, 0),
          },
        })),
      },
    } as any;
    const service = new DriverGoService(prisma, {} as any);
    jest.spyOn(service as any, 'driverFor').mockResolvedValue({ id: 'drv-1' });
    jest.spyOn(service as any, 'shapeJob').mockImplementation((j: any) => j);

    const r = await service.getEarnings({ sub: 'u1' } as any);

    expect(r.trips).toHaveLength(100);
    expect(r.month).toBe(150 * 200); // was 100 * 200 when summed from the list
    const froms = prisma.driverBooking.aggregate.mock.calls.map((c: any[]) => c[0].where.completedAt.gte.getTime());
    expect(froms).toEqual(
      expect.arrayContaining([istDayStart().getTime(), istWeekStart().getTime(), istMonthStart().getTime()]),
    );
  });
});

describe('driver trip list', () => {
  it('always includes every open trip, plus only the latest 50 finished ones', async () => {
    const prisma = { driverBooking: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new DriverGoService(prisma, {} as any);
    jest.spyOn(service as any, 'driverFor').mockResolvedValue({ id: 'drv-1' });
    await service.getJobs({ sub: 'u1' } as any);
    const [open, finished] = prisma.driverBooking.findMany.mock.calls.map((c: any[]) => c[0]);
    expect(open.where.status.in).toEqual(['REQUESTED', 'CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS']);
    expect(open.orderBy).toEqual([{ startAt: 'asc' }]);
    expect(finished.where.status.notIn).toBeDefined();
    expect(finished.orderBy).toEqual([{ startAt: 'desc' }]);
    expect(finished.take).toBe(50);
  });
});

describe('driver earnings: deleted trips and fee', () => {
  function setup() {
    const prisma = {
      driverBooking: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { driverEarning: 0 } }),
      },
    } as any;
    const service = new DriverGoService(prisma, {} as any);
    jest.spyOn(service as any, 'driverFor').mockResolvedValue({ id: 'drv-1' });
    return { prisma, service };
  }

  it('leaves deleted trips out of the list and every total, like the graph does', async () => {
    const { prisma, service } = setup();
    await service.getEarnings({ sub: 'u1' } as any);
    expect(prisma.driverBooking.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
    const totals = prisma.driverBooking.aggregate.mock.calls.map((c: any[]) => c[0].where);
    expect(totals).toHaveLength(3);
    for (const where of totals) expect(where.deletedAt).toBeNull();
  });

  it('sends the platform fee rate so the app never hard-codes it', async () => {
    const { service } = setup();
    const r = await service.getEarnings({ sub: 'u1' } as any);
    expect(r.platformFeeRate).toBe(0.18);
  });
});

describe('driver trip list filtered by status', () => {
  async function orderFor(status: string) {
    const prisma = { driverBooking: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new DriverGoService(prisma, {} as any);
    jest.spyOn(service as any, 'driverFor').mockResolvedValue({ id: 'drv-1' });
    await service.getJobs({ sub: 'u1' } as any, status as any);
    return prisma.driverBooking.findMany.mock.calls[0][0].orderBy;
  }

  it('finished trips come newest first, so a busy driver sees their latest 100', async () => {
    expect(await orderFor('COMPLETED')).toEqual([{ startAt: 'desc' }]);
    expect(await orderFor('CANCELLED')).toEqual([{ startAt: 'desc' }]);
  });

  it('open trips stay soonest first', async () => {
    expect(await orderFor('REQUESTED')).toEqual([{ startAt: 'asc' }]);
    expect(await orderFor('IN_PROGRESS')).toEqual([{ startAt: 'asc' }]);
  });
});
