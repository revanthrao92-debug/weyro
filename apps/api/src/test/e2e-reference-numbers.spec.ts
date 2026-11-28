/**
 * Weyro reference numbers against a real PostgreSQL database: the trigger, the daily counter
 * and the formula in @weyro/api-contracts must agree, under concurrency and rollbacks.
 * Excluded from `npm test`; run via `npm run test:e2e -w @weyro/api`.
 */
import { parseRef } from '@weyro/api-contracts';
import { PrismaService } from '../prisma/prisma.service';

/** YYMMDD of a moment in India time. */
const indiaDay = (at: Date) => {
  const ist = new Date(at.getTime() + 330 * 60_000).toISOString();
  return ist.slice(2, 4) + ist.slice(5, 7) + ist.slice(8, 10);
};

describe('Reference numbers (database trigger + formula)', () => {
  const suffix = `${Date.now()}`;
  let prisma: PrismaService;
  let customerUserId: string;
  let customerProfileId: string;
  let vehicleId: string;

  const newRequest = (title: string, createdAt?: Date) =>
    prisma.serviceRequest.create({
      data: {
        customerId: customerProfileId,
        vehicleId,
        category: 'REPAIR',
        title,
        description: 'Reference number test',
        address: 'Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        urgency: 'NORMAL',
        status: 'OPEN',
        isBroadcast: false,
        expiresAt: new Date(Date.now() + 86_400_000),
        ...(createdAt ? { createdAt } : {}),
      },
    });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const customer = await prisma.user.create({
      data: {
        email: `e2e-ref-${suffix}@example.com`,
        phone: `+9196000${suffix.slice(-5)}`,
        passwordHash: 'not-a-real-hash',
        role: 'CUSTOMER',
        customerProfile: { create: { firstName: 'Ref', lastName: 'Test' } },
      },
      include: { customerProfile: true },
    });
    customerUserId = customer.id;
    customerProfileId = customer.customerProfile!.id;
    const vehicle = await prisma.vehicle.create({
      data: { customerId: customerProfileId, make: 'Test', model: 'Ref', year: 2020, registrationNumber: `REF-${suffix}` },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    await prisma.serviceRequest.deleteMany({ where: { customerId: customerProfileId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: customerUserId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('a new record gets a valid number with the India date, even if the caller sends its own', async () => {
    const r = await prisma.serviceRequest.create({
      data: {
        customerId: customerProfileId,
        vehicleId,
        category: 'REPAIR',
        title: 'caller tries to pick its own number',
        description: 'x',
        address: 'Bengaluru',
        latitude: 12.97,
        longitude: 77.59,
        urgency: 'NORMAL',
        status: 'OPEN',
        expiresAt: new Date(Date.now() + 86_400_000),
        ref: 'R-000000-0001-0',
      },
    });
    const parsed = parseRef(r.ref);
    expect(parsed?.type).toBe('R');
    expect(parsed?.day).toBe(indiaDay(r.createdAt));
    expect(r.ref).not.toBe('R-000000-0001-0');
  });

  it('late-night UTC belongs to the next India day', async () => {
    const lateUtc = new Date('2026-03-04T20:15:00.000Z'); // 01:45 on 5 Mar in India
    const r = await newRequest('late night', lateUtc);
    expect(parseRef(r.ref)?.day).toBe('260305');
  });

  it('50 records saved at the same moment all get different numbers, with no gaps', async () => {
    const made = await Promise.all(Array.from({ length: 50 }, (_, i) => newRequest(`parallel ${i}`)));
    const parsed = made.map((r) => parseRef(r.ref));
    expect(parsed.every(Boolean)).toBe(true);
    expect(new Set(made.map((r) => r.ref)).size).toBe(50);
    const counts = parsed.map((p) => p!.count).sort((a, b) => a - b);
    expect(counts[counts.length - 1] - counts[0]).toBe(49); // one unbroken run
  });

  it('a cancelled save does not use up a number', async () => {
    const before = await newRequest('before');
    await prisma
      .$transaction(async (tx) => {
        await tx.serviceRequest.create({
          data: {
            customerId: customerProfileId, vehicleId, category: 'REPAIR', title: 'rolled back', description: 'x',
            address: 'Bengaluru', latitude: 12.97, longitude: 77.59, urgency: 'NORMAL', status: 'OPEN',
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        });
        throw new Error('roll back');
      })
      .catch(() => undefined);
    const after = await newRequest('after');
    expect(parseRef(after.ref)!.count).toBe(parseRef(before.ref)!.count + 1);
  });

  it('a number can never be changed', async () => {
    const r = await newRequest('locked');
    await expect(prisma.serviceRequest.update({ where: { id: r.id }, data: { ref: 'R-260101-0001-1' } })).rejects.toThrow(
      /cannot be changed/,
    );
    const again = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(again.ref).toBe(r.ref);
  });

  it('every existing record has a valid, unique number', async () => {
    const rows = await prisma.$queryRaw<{ ref: string }[]>`
      SELECT ref FROM service_requests UNION ALL SELECT ref FROM quotations UNION ALL SELECT ref FROM bookings
      UNION ALL SELECT ref FROM spare_part_orders UNION ALL SELECT ref FROM driver_bookings
      UNION ALL SELECT ref FROM payments UNION ALL SELECT ref FROM refunds`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !parseRef(r.ref))).toEqual([]);
    expect(new Set(rows.map((r) => r.ref)).size).toBe(rows.length);
  });
});
