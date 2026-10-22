/**
 * End-to-end database tests against a real PostGIS database.
 *
 * Verifies geospatial storage/queries, soft-delete helpers, idempotency key
 * uniqueness, and audit-log writes. These require a live PostgreSQL + PostGIS
 * instance (provided by the CI service container or docker-compose), so they
 * are excluded from the default `npm test` run and executed via `npm run
 * test:e2e -w @weyro/api`.
 */

import { PrismaService, withSoftDelete } from '../prisma/prisma.service';

describe('PostGIS & Soft Delete E2E', () => {
  const suffix = `${Date.now()}`;
  let prisma: PrismaService;
  let customerUserId: string;
  let providerUserId: string;
  let customerProfileId: string;
  let vehicleId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const customer = await prisma.user.create({
      data: {
        email: `e2e-customer-${suffix}@example.com`,
        phone: `+9198000${suffix.slice(-5)}`,
        passwordHash: 'not-a-real-hash',
        role: 'CUSTOMER',
        customerProfile: {
          create: {
            firstName: 'E2E',
            lastName: 'Customer',
          },
        },
      },
      include: { customerProfile: true },
    });
    customerUserId = customer.id;
    customerProfileId = customer.customerProfile!.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        customerId: customerProfileId,
        make: 'Test',
        model: 'Vehicle',
        year: 2020,
        registrationNumber: `E2E-${suffix}`,
      },
    });
    vehicleId = vehicle.id;

    const provider = await prisma.user.create({
      data: {
        email: `e2e-provider-${suffix}@example.com`,
        phone: `+9197000${suffix.slice(-5)}`,
        passwordHash: 'not-a-real-hash',
        role: 'PROVIDER',
        providerProfile: {
          create: {
            businessName: 'E2E Test Garage',
            providerType: 'MECHANIC',
            description: 'Test provider',
            phone: `+9197000${suffix.slice(-5)}`,
            address: 'Test Address, Bengaluru',
            latitude: 12.9716,
            longitude: 77.5946,
            verificationStatus: 'PENDING',
          },
        },
      },
    });
    providerUserId = provider.id;
  });

  afterAll(async () => {
    await prisma.serviceRequest
      .deleteMany({ where: { customerId: customerProfileId } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [customerUserId, providerUserId] } } })
      .catch(() => undefined);
    await prisma.auditLog
      .deleteMany({ where: { actorRole: 'E2E_TEST' } })
      .catch(() => undefined);
    await prisma.idempotencyKey
      .deleteMany({ where: { endpoint: '/api/v1/e2e-test' } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  describe('PostGIS geo queries', () => {
    it('stores a geography point and computes distance', async () => {
      const request = await prisma.serviceRequest.create({
        data: {
          customerId: customerProfileId,
          vehicleId,
          category: 'REPAIR',
          title: 'E2E bumper repair',
          description: 'Test description',
          address: 'Bengaluru',
          latitude: 12.9716,
          longitude: 77.5946,
          urgency: 'NORMAL',
          status: 'OPEN',
          isBroadcast: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // `location` is an Unsupported(...) column, so it is written via raw SQL.
      await prisma.$executeRaw`
        UPDATE "service_requests"
        SET "location" = ST_GeogFromText('SRID=4326;POINT(77.5946 12.9716)')
        WHERE "id" = ${request.id}
      `;

      const rows = await prisma.$queryRaw<
        Array<{ distance: number }>
      >`
        SELECT ST_Distance(
          "location",
          ST_GeogFromText('SRID=4326;POINT(77.5946 12.9716)')
        ) AS distance
        FROM "service_requests"
        WHERE "id" = ${request.id}
      `;

      expect(rows).toHaveLength(1);
      expect(Number(rows[0].distance)).toBeCloseTo(0, 3);
    });

    it('stores towing dropoff geography and fare fields', async () => {
      const request = await prisma.serviceRequest.create({
        data: {
          customerId: customerProfileId,
          vehicleId,
          category: 'TOWING',
          title: 'E2E towing request',
          description: 'Flatbed tow required',
          address: 'Indiranagar, Bengaluru',
          latitude: 12.9784,
          longitude: 77.6408,
          urgency: 'URGENT',
          status: 'OPEN',
          isBroadcast: true,
          fulfillmentType: 'TOW_TO_GARAGE',
          dropoffAddress: 'Koramangala, Bengaluru',
          dropoffLatitude: 12.9352,
          dropoffLongitude: 77.6245,
          towingVehicleType: 'FLATBED',
          vehicleWeightKg: 1450,
          towingDistanceKm: 5.12,
          towingEstimatedFare: 705,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await prisma.$executeRaw`
        UPDATE "service_requests"
        SET "dropoffLocation" = ST_SetSRID(
          ST_MakePoint(77.6245, 12.9352),
          4326
        )::geography
        WHERE "id" = ${request.id}
      `;

      const rows = await prisma.$queryRaw<
        Array<{ distance: number; fare: number }>
      >`
        SELECT
          ST_Distance(
            "dropoffLocation",
            ST_GeogFromText('SRID=4326;POINT(77.6408 12.9784)')
          ) / 1000 AS distance,
          "towingEstimatedFare" AS fare
        FROM "service_requests"
        WHERE "id" = ${request.id}
      `;

      expect(rows).toHaveLength(1);
      expect(Number(rows[0].distance)).toBeGreaterThan(5);
      expect(Number(rows[0].fare)).toBe(705);
    });
  });

  describe('Soft delete behavior', () => {
    it('sets deletedAt and excludes the row via the soft-delete filter', async () => {
      const provider = await prisma.providerProfile.findUniqueOrThrow({
        where: { userId: providerUserId },
      });

      await prisma.softDelete('ProviderProfile', { id: provider.id });

      const visible = await prisma.providerProfile.findFirst({
        where: withSoftDelete({ id: provider.id }),
      });
      expect(visible).toBeNull();

      const deleted = await prisma.providerProfile.findFirst({
        where: { id: provider.id, deletedAt: { not: null } },
      });
      expect(deleted).not.toBeNull();
      expect(deleted!.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('Idempotency keys', () => {
    const key = `e2e-idempotency-${suffix}`;

    it('persists a key and enforces uniqueness', async () => {
      const data = {
        key,
        endpoint: '/api/v1/e2e-test',
        method: 'POST',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const created = await prisma.idempotencyKey.create({ data });
      expect(created.status).toBe('PENDING');

      await expect(prisma.idempotencyKey.create({ data })).rejects.toThrow();

      const found = await prisma.idempotencyKey.findUnique({ where: { key } });
      expect(found?.endpoint).toBe('/api/v1/e2e-test');
    });
  });

  describe('Audit log', () => {
    it('writes an audit entry via writeAuditLog', async () => {
      await prisma.writeAuditLog({
        actorId: customerUserId,
        actorRole: 'E2E_TEST',
        action: 'e2e.audit',
        entityType: 'ServiceRequest',
        entityId: 'e2e-entity',
        newValues: { verified: true },
      });

      const entry = await prisma.auditLog.findFirst({
        where: { actorRole: 'E2E_TEST', action: 'e2e.audit' },
      });

      expect(entry).not.toBeNull();
      expect(entry!.entityId).toBe('e2e-entity');
      expect(entry!.createdAt).toBeInstanceOf(Date);
    });
  });
});
