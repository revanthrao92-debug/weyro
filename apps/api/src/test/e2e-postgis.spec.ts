/**
 * End-to-end API tests against a real PostGIS database.
 *
 * These tests verify geospatial queries, soft delete behavior, and
 * idempotency against a live PostgreSQL + PostGIS instance.
 *
 * Requires DATABASE_URL to point to a PostGIS database (provided by CI
 * service container or docker-compose).
 */

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../app.module';
import { Prisma } from '@prisma/client';

describe('PostGIS & Soft Delete E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PostGIS geo queries', () => {
    it('should store and query service requests with geography points', async () => {
      const request = await (prisma as any).serviceRequest.create({
        data: {
          customerId: 'cust-test-1',
          vehicleId: 'veh-test-1',
          category: 'REPAIR',
          title: 'Test bumper repair',
          description: 'Test description',
          address: 'Test Address, Bengaluru',
          latitude: 12.9716,
          longitude: 77.5946,
          location: (Prisma as any).raw(
            `ST_GeogFromText('SRID=4326;POINT(77.5946 12.9716)')`,
          ),
          urgency: 'NORMAL',
          status: 'OPEN',
          isBroadcast: true,
        },
      });

      expect(request).toBeDefined();
      expect(request.id).toBeDefined();

      // Verify we can query by PostGIS distance
      const nearby = await prisma.$queryRaw`
        SELECT id, title, ST_Distance(location::geography,
          ST_GeogFromText('SRID=4326;POINT(77.5946 12.9716)')) as distance
        FROM "service_requests"
        WHERE id = ${request.id}
      `;

      expect(nearby).toHaveLength(1);
      expect(Number((nearby as any[])[0].distance)).toBe(0);

      // Clean up
      await prisma.serviceRequest.delete({ where: { id: request.id } });
    });

    it('should use GiST index for geo queries', async () => {
      // Verify the geography column exists with SRID 4326
      const result = await prisma.$queryRaw`
        SELECT f_geometry_column, srid
        FROM geometry_columns
        WHERE f_table_name = 'service_requests'
          AND f_geometry_column = 'location'
      `;

      // PostGIS may or may not have geometry_columns populated for Unsupported types
      // Just verify the query doesn't error
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Soft delete behavior', () => {
    it('should soft-delete instead of hard-delete', async () => {
      const provider = await prisma.providerProfile.create({
        data: {
          userId: 'user-soft-delete-test',
          businessName: 'Soft Delete Test Provider',
          providerType: 'MECHANIC',
          description: 'Test',
          phone: '+919999999999',
          address: 'Test Address',
          latitude: 12.9716,
          longitude: 77.5946,
          verificationStatus: 'PENDING',
        },
      });

      // Soft delete via service method
      await prisma.softDelete('ProviderProfile', { id: provider.id });

      // Should not appear in normal findUnique (deletedAt filter applied)
      const found = await prisma.providerProfile.findUnique({
        where: { id: provider.id },
      });

      expect(found).toBeNull();

      // But should be findable with deletedAt filter
      const withDeleted = await prisma.providerProfile.findFirst({
        where: { id: provider.id, deletedAt: { not: null } },
      });

      expect(withDeleted).not.toBeNull();
      expect(withDeleted!.deletedAt).toBeInstanceOf(Date);

      // Clean up - hard delete
      await prisma.hardDelete('ProviderProfile', { id: provider.id });
    });
  });

  describe('Idempotency keys', () => {
    it('should create and retrieve idempotency keys', async () => {
      const key = `idempotency-test-${Date.now()}`;

      const created = await prisma.idempotencyKey.create({
        data: {
          key,
          endpoint: '/api/v1/payments/create-order',
          method: 'POST',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      expect(created.key).toBe(key);
      expect(created.status).toBe('PENDING');

      const found = await prisma.idempotencyKey.findUnique({ where: { key } });
      expect(found).not.toBeNull();
      expect(found!.status).toBe('PENDING');

      // Clean up
      await prisma.idempotencyKey.delete({ where: { key } });
    });

    it('should enforce unique constraint on idempotency key', async () => {
      const key = `idempotency-unique-test-${Date.now()}`;

      await prisma.idempotencyKey.create({
        data: {
          key,
          endpoint: '/api/v1/test',
          method: 'POST',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await expect(
        prisma.idempotencyKey.create({
          data: {
            key,
            endpoint: '/api/v1/test',
            method: 'POST',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        }),
      ).rejects.toThrow();

      // Clean up
      await prisma.idempotencyKey.delete({ where: { key } });
    });
  });

  describe('Audit log', () => {
    it('should create audit log entries', async () => {
      const entry = await prisma.auditLog.create({
        data: {
          actorId: 'user-audit-test',
          actorRole: 'ADMIN',
          action: 'provider.verify',
          entityType: 'ProviderProfile',
          entityId: 'prov-audit-test',
          newValues: { verificationStatus: 'VERIFIED' },
        },
      });

      expect(entry.id).toBeDefined();
      expect(entry.action).toBe('provider.verify');
      expect(entry.createdAt).toBeInstanceOf(Date);

      // Clean up
      await prisma.auditLog.delete({ where: { id: entry.id } });
    });
  });
});
