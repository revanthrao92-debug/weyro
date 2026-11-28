/**
 * The non-personal event history against a real PostgreSQL database: triggers record every
 * creation and status change, nothing personal gets in, history can't be changed, and the nightly
 * dataset task records cleaned text once and writes each day file once.
 * Excluded from `npm test`; run via `npm run test:e2e -w @weyro/api`.
 */
import { gunzipSync } from 'zlib';
import { PrismaService } from '../prisma/prisma.service';
import { TRAINING_TEXT_CLEANER_VERSION } from '@weyro/api-contracts';
import { DatasetService, datasetKey, indiaDay } from '../modules/tasks/dataset.service';

/** In-memory private storage, so the test never touches real files. */
class MemoryStorage {
  files = new Map<string, Buffer>();
  async putPrivateObject(p: { key: string; body: Buffer }) {
    this.files.set(p.key, p.body);
  }
  async objectExists(key: string) {
    return this.files.has(key);
  }
  async deletePrivateObject(key: string) {
    this.files.delete(key);
  }
}

describe('Event history (database triggers + nightly dataset)', () => {
  const suffix = `${Date.now()}`;
  // Personal details that must never reach the history.
  const SECRET = {
    first: `Zorawar${suffix.slice(-4)}`,
    last: `Pillai${suffix.slice(-4)}`,
    email: `e2e-events-${suffix}@example.com`,
    phone: `+9195000${suffix.slice(-5)}`,
    address: `${suffix.slice(-3)} Secret Lane, Koramangala`,
    plate: `KA05EV${suffix.slice(-4)}`,
  };
  const LAT = 12.934567891;
  const LNG = 77.612345678;
  let prisma: PrismaService;
  let userId: string;
  let customerId: string;
  let vehicleId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: SECRET.email,
        phone: SECRET.phone,
        passwordHash: 'not-a-real-hash',
        role: 'CUSTOMER',
        customerProfile: { create: { firstName: SECRET.first, lastName: SECRET.last } },
      },
      include: { customerProfile: true },
    });
    userId = user.id;
    customerId = user.customerProfile!.id;
    vehicleId = (
      await prisma.vehicle.create({
        data: { customerId, make: 'Hyundai', model: 'Creta', year: 2022, registrationNumber: SECRET.plate },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.serviceRequest.deleteMany({ where: { customerId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  const newRequest = (description: string) =>
    prisma.serviceRequest.create({
      data: {
        customerId,
        vehicleId,
        category: 'REPAIR',
        title: 'Front bumper dent',
        description,
        address: SECRET.address,
        latitude: LAT,
        longitude: LNG,
        urgency: 'NORMAL',
        status: 'OPEN',
        vehicleMake: 'Hyundai',
        vehicleModel: 'Creta',
        vehicleYear: 2022,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

  const eventsFor = (ref: string) => prisma.event.findMany({ where: { entityRef: ref }, orderBy: { seq: 'asc' } });

  it('records creation and each status change once, with non-personal facts only', async () => {
    const r = await newRequest('Scraping noise');
    await prisma.serviceRequest.update({ where: { id: r.id }, data: { status: 'IN_PROGRESS' } });
    await prisma.serviceRequest.update({ where: { id: r.id }, data: { title: 'Front bumper dent (edited)' } }); // not a status change
    const events = await eventsFor(r.ref);
    expect(events.map((e) => [e.type, e.fromStatus, e.toStatus])).toEqual([
      ['created', null, 'OPEN'],
      ['status_changed', 'OPEN', 'IN_PROGRESS'],
    ]);
    const data = events[0].data as Record<string, unknown>;
    expect(data).toMatchObject({ category: 'REPAIR', vehicleMake: 'Hyundai', vehicleModel: 'Creta', vehicleYear: 2022 });
    // Area rounded to ~1 km, never the exact point.
    expect(data.areaLat).toBe(12.93);
    expect(data.areaLng).toBe(77.61);
    const all = JSON.stringify(events, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
    for (const value of [...Object.values(SECRET), String(LAT), String(LNG), userId, customerId, vehicleId]) {
      expect(all).not.toContain(value);
    }
  });

  it('a request without a saved vehicle still keeps its facts (a missing lookup must not wipe them)', async () => {
    const r = await prisma.serviceRequest.create({
      data: {
        customerId,
        category: 'TOWING',
        title: 'Tow to garage',
        description: 'x',
        address: SECRET.address,
        latitude: LAT,
        longitude: LNG,
        urgency: 'URGENT',
        status: 'OPEN',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const [created] = await eventsFor(r.ref);
    expect(created.data).toMatchObject({ category: 'TOWING', urgency: 'URGENT', areaLat: 12.93 });
  });

  it('status history can never be edited or deleted', async () => {
    const r = await newRequest('x');
    const [e] = await eventsFor(r.ref);
    await expect(prisma.event.update({ where: { id: e.id }, data: { type: 'changed' } })).rejects.toThrow(/cannot be changed/);
    await expect(prisma.event.delete({ where: { id: e.id } })).rejects.toThrow(/cannot be changed/);
  });

  it('when the cleaner improves, old text is replaced and its day file is rewritten', async () => {
    const r = await newRequest(`Pickup: ${SECRET.address}\nEngine overheats`);
    // Text recorded earlier by an older cleaner that missed the address.
    const oldDay = '2026-01-15';
    await prisma.event.create({
      data: {
        type: 'text',
        entityType: 'Request',
        entityRef: r.ref,
        occurredAt: new Date('2026-01-15T06:00:00Z'),
        data: { field: 'description', text: `Pickup: ${SECRET.address} Engine overheats`, v: TRAINING_TEXT_CLEANER_VERSION - 1 },
      },
    });
    const storage = new MemoryStorage();
    storage.files.set(datasetKey(oldDay), Buffer.from('old file with the address'));
    const lock = { tryLock: async () => true, release: async () => undefined } as any;
    await new DatasetService(prisma, lock, storage as any).captureText();

    const texts = await prisma.event.findMany({ where: { entityRef: r.ref, type: 'text' } });
    const descriptions = texts.filter((t) => (t.data as any).field === 'description');
    expect(descriptions).toHaveLength(1); // the old copy is gone
    expect((descriptions[0].data as any).text).toBe('Pickup: [address] Engine overheats');
    expect((descriptions[0].data as any).v).toBe(TRAINING_TEXT_CLEANER_VERSION);
    expect(JSON.stringify(texts, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain(SECRET.address);
    expect(storage.files.has(datasetKey(oldDay))).toBe(false); // rewritten on the next export
  });

  it('nightly text capture records cleaned text once, and replaces it only when it changes', async () => {
    const r = await newRequest(`Call ${SECRET.phone} or mail ${SECRET.email}, car ${SECRET.plate}, scraping noise at 40 km/h`);
    const lock = { tryLock: async () => true, release: async () => undefined } as any;
    const service = new DatasetService(prisma, lock, new MemoryStorage() as any);

    await service.captureText();
    const texts = () => prisma.event.findMany({ where: { entityRef: r.ref, type: 'text' }, orderBy: { seq: 'asc' } });
    const first = await texts();
    const description = first.find((e) => (e.data as any).field === 'description');
    expect((description?.data as any).text).toBe('Call [phone] or mail [email], car [vehicle-number], scraping noise at 40 km/h');

    await service.captureText(); // nothing changed: nothing new
    expect((await texts()).length).toBe(first.length);

    await prisma.serviceRequest.update({ where: { id: r.id }, data: { description: 'Also the left headlamp is cracked' } });
    await service.captureText();
    const after = await texts();
    // Only the newest cleaned copy is kept per field: the edit replaces the old description.
    expect(after.length).toBe(first.length);
    const descriptions = after.filter((e) => (e.data as any).field === 'description');
    expect(descriptions.map((e) => (e.data as any).text)).toEqual(['Also the left headlamp is cracked']);
  });

  it('writes each finished India day once as gzipped JSON lines, and never rewrites it', async () => {
    const storage = new MemoryStorage();
    const lock = { tryLock: async () => true, release: async () => undefined } as any;
    const service = new DatasetService(prisma, lock, storage as any);
    const r = await newRequest('for export');
    const today = indiaDay(new Date());
    const tomorrow = new Date(Date.now() + 86_400_000);

    const written = await service.exportFinishedDays(tomorrow); // "today" is finished from tomorrow's point of view
    expect(written).toContain(today);
    const lines = gunzipSync(storage.files.get(datasetKey(today))!).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.some((l) => l.entityRef === r.ref && l.type === 'created')).toBe(true);
    expect(JSON.stringify(lines)).not.toContain(SECRET.email);

    const again = await service.exportFinishedDays(tomorrow);
    expect(again).not.toContain(today); // already written: skipped
    expect(await service.exportFinishedDays(new Date())).not.toContain(today); // today isn't finished yet
  });
});
