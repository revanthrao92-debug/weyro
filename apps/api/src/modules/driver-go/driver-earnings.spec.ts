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
