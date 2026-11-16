import { MediaUrlService, MEDIA_URL_TTL_SECONDS } from './media-url.service';
import { S3StorageService } from './services/s3-storage.service';
import { MediaUrlInterceptor } from '../../common/interceptors/media-url.interceptor';

/**
 * C3: the DB stores keys, so a URL minted at read time is always fresh.
 * Uses the real SigV4 presigner (offline, fake credentials) and a mocked clock.
 */
describe('MediaUrlService – signed URLs never expire in storage (C3)', () => {
  const key = 'damage-requests/user-1/1700000000000_ab12cd34.jpg';
  const DAY = 24 * 60 * 60 * 1000;
  let service: MediaUrlService;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] });
    const storage = new S3StorageService({
      bucket: 'weyro-test',
      region: 'ap-south-1',
      accessKey: 'AKIATESTKEY',
      secretKey: 'test-secret',
    });
    service = new MediaUrlService(storage);
  });
  afterEach(() => jest.useRealTimers());

  /** Parse an S3 presigned URL into [signedAt, expiresAt]. */
  const window = (url: string): [Date, Date] => {
    const q = new URL(url).searchParams;
    const d = q.get('X-Amz-Date')!; // 20261116T101500Z
    const signedAt = new Date(
      `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`,
    );
    return [signedAt, new Date(signedAt.getTime() + Number(q.get('X-Amz-Expires')) * 1000)];
  };

  it('signs with a one-hour TTL', async () => {
    jest.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    const url = await service.sign(key);
    expect(new URL(url).pathname).toContain(key);
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe(String(MEDIA_URL_TTL_SECONDS));
    expect(MEDIA_URL_TTL_SECONDS).toBe(3600);
  });

  it('a request created today still returns a fresh, valid URL when read 8 days later', async () => {
    jest.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    const row = { id: 'req-1', damagePhotos: [key], media: [{ id: 'm1', url: key, fileType: 'image/jpeg' }] };
    const interceptor = new MediaUrlInterceptor(service);

    const day0 = (await interceptor.transform(row)) as typeof row;
    const [, day0Expiry] = window(day0.damagePhotos[0]);

    // +8 days: the old 7-day presigned URL would be dead by now.
    const now = new Date(Date.now() + 8 * DAY);
    jest.setSystemTime(now);
    expect(now.getTime()).toBeGreaterThan(day0Expiry.getTime() + 7 * DAY - 1);

    const day8 = (await interceptor.transform(row)) as typeof row;
    for (const url of [day8.damagePhotos[0], day8.media[0].url]) {
      const [signedAt, expiresAt] = window(url);
      // signed "now" and still valid for the next hour — not a stale day-0 URL
      expect(Math.abs(signedAt.getTime() - now.getTime())).toBeLessThan(2000);
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(new URL(url).pathname).toContain(key);
    }
    expect(day8.damagePhotos[0]).not.toBe(day0.damagePhotos[0]);
  });

  it('resolve() leaves external URLs and empty values alone, and signs legacy URLs by key', async () => {
    jest.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    expect(await service.resolve(null)).toBeNull();
    expect(await service.resolve('https://images.unsplash.com/p.jpg')).toBe('https://images.unsplash.com/p.jpg');
    const legacy = `https://weyro-test.s3.ap-south-1.amazonaws.com/${key}?X-Amz-Expires=604800&X-Amz-Signature=old`;
    const resolved = (await service.resolve(legacy)) as string;
    expect(new URL(resolved).searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(resolved).not.toContain('X-Amz-Signature=old');
  });
});

describe('MediaUrlInterceptor – serializes every media field', () => {
  const stub = { resolve: async (v: string | null | undefined) => (v ? `signed:${v}` : v) } as unknown as MediaUrlService;
  const interceptor = new MediaUrlInterceptor(stub);

  it('signs imageUrl, avatarUrl, damagePhotos, mediaUrls and media[].url at any depth', async () => {
    const out = (await interceptor.transform({
      items: [
        {
          imageUrl: 'spare-parts/u/a.jpg',
          customer: { avatarUrl: 'avatars/u/b.jpg' },
          damagePhotos: ['damage-requests/u/c.jpg'],
          media: [{ url: 'damage-requests/u/d.jpg', fileType: 'image/jpeg' }],
          messages: [{ mediaUrls: ['avatars/u/e.jpg'] }],
        },
      ],
    })) as any;
    const item = out.items[0];
    expect(item.imageUrl).toBe('signed:spare-parts/u/a.jpg');
    expect(item.customer.avatarUrl).toBe('signed:avatars/u/b.jpg');
    expect(item.damagePhotos).toEqual(['signed:damage-requests/u/c.jpg']);
    expect(item.media[0].url).toBe('signed:damage-requests/u/d.jpg');
    expect(item.messages[0].mediaUrls).toEqual(['signed:avatars/u/e.jpg']);
  });

  it('keeps null avatars, Dates, and unrelated url fields untouched', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const out = (await interceptor.transform({ avatarUrl: null, createdAt, link: { url: 'https://x.io' } })) as any;
    expect(out.avatarUrl).toBeNull();
    expect(out.createdAt).toBe(createdAt);
    expect(out.link.url).toBe('https://x.io'); // not a media row (no fileType)
  });
});
