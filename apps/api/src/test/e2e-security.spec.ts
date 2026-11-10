import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { env } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../modules/auth/auth.service';

/**
 * Phase 1 security regressions — authentication, authorization, validation.
 * Runs against the real Postgres / PostGIS database like the other e2e suites.
 */

const API = '/api/v1';
const password = 'SecurityPass123!';

interface Session {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  profileId?: string;
}

describe('Security foundations (Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let phoneSeq = 0;
  const http = () => request(app.getHttpServer());

  const register = async (
    tag: string,
    role: 'CUSTOMER' | 'PROVIDER',
  ): Promise<Session> => {
    // Use the service directly so the suite doesn't exhaust the HTTP
    // registration throttle (5/min) — the endpoint itself is covered by the
    // validation test below.
    const res = await authService.register({
      email: `sec-${tag}-${suffix}@example.com`,
      phone: `+919${String(Date.now() % 100000).padStart(5, '0')}${String(phoneSeq++).padStart(5, '0')}`,
      password,
      role,
      firstName: 'Sec',
      lastName: tag,
      ...(role === 'PROVIDER'
        ? { latitude: 12.9716, longitude: 77.5946, address: 'Bengaluru' }
        : {}),
    } as never);

    return {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      userId: res.user.id,
      profileId:
        (res.user as any).customerProfile?.id ??
        (res.user as any).providerProfile?.id,
    };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a forged JWT signature', async () => {
    const forged = await new JwtService().signAsync(
      { sub: 'attacker', role: 'ADMIN' },
      { secret: 'forged-secret-that-is-long-enough-32chars' },
    );

    const res = await http()
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired JWT', async () => {
    const expired = await new JwtService().signAsync(
      { sub: 'user-1', role: 'CUSTOMER' },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: '-5s' },
    );

    const res = await http()
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('prevents a customer from reading another customer\'s request (IDOR)', async () => {
    const owner = await register('owner', 'CUSTOMER');
    const other = await register('other', 'CUSTOMER');

    const created = await http()
      .post(`${API}/damage-requests`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        category: 'REPAIR',
        title: 'Brake noise',
        description: 'Front brakes squeal at low speed.',
        address: 'Indiranagar, Bengaluru',
        latitude: 12.9784,
        longitude: 77.6408,
        urgency: 'NORMAL',
        mediaUrls: [],
        damagePhotos: [],
        isBroadcast: true,
      });
    expect(created.status).toBe(201);

    const res = await http()
      .get(`${API}/damage-requests/${created.body.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks non-admin users from admin endpoints', async () => {
    const customer = await register('admincheck', 'CUSTOMER');
    const res = await http()
      .get(`${API}/admin/overview`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects unknown request properties (strict DTOs)', async () => {
    const res = await http().post(`${API}/auth/register`).send({
      email: `extra-${suffix}@example.com`,
      phone: `+9193${suffix.slice(-8)}`,
      password,
      role: 'CUSTOMER',
      firstName: 'Extra',
      lastName: 'Field',
      isAdmin: true,
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid route ids before they reach the database', async () => {
    const customer = await register('badid', 'CUSTOMER');
    const res = await http()
      .get(`${API}/damage-requests/${encodeURIComponent('bad id!')}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('rejects negative quotation amounts', async () => {
    const customer = await register('quoteowner', 'CUSTOMER');
    const provider = await register('quoteprovider', 'PROVIDER');

    await prisma.providerProfile.update({
      where: { id: provider.profileId! },
      data: { verificationStatus: 'VERIFIED' },
    });

    const created = await http()
      .post(`${API}/damage-requests`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        category: 'REPAIR',
        title: 'Clutch replacement',
        description: 'Clutch slips under acceleration.',
        address: 'Koramangala, Bengaluru',
        latitude: 12.9352,
        longitude: 77.6245,
        urgency: 'NORMAL',
        mediaUrls: [],
        damagePhotos: [],
        isBroadcast: true,
      });
    expect(created.status).toBe(201);

    const res = await http()
      .post(`${API}/damage-requests/${created.body.id}/quotations`)
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        partsCost: -500,
        labourCost: 1000,
        warrantyDays: 30,
        etaDescription: 'Same day',
      });
    expect(res.status).toBe(400);
  });

  it('invalidates refresh tokens on rotation and after logout', async () => {
    const session = await register('refresh', 'CUSTOMER');

    const rotated = await http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: session.refreshToken });
    expect(rotated.status).toBe(201);

    // Replaying the rotated token revokes the family.
    const replay = await http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: session.refreshToken });
    expect(replay.status).toBe(401);

    // The newly issued token is revoked by the replay detection above.
    const afterReplay = await http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: rotated.body.refreshToken });
    expect(afterReplay.status).toBe(401);
  });

  it('revokes the refresh token on logout', async () => {
    const session = await register('logout', 'CUSTOMER');

    const logout = await http()
      .post(`${API}/auth/logout`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ refreshToken: session.refreshToken });
    expect([200, 201, 204]).toContain(logout.status);

    const res = await http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(401);
  });
});
