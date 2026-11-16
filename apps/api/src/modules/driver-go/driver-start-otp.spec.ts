import { BadRequestException } from '@nestjs/common';
import { DriverGoService } from './driver-go.service';
import { hashDriverStartOtp } from './driver-otp';
import { DriverStartOtpDto } from './dto/driver-go.dto';

/**
 * M7: the start code must survive brute force, including PARALLEL guesses.
 * The fake DB below behaves like Postgres: every caller reads a snapshot taken
 * before any of them wrote (so a read-check-then-increment lets them all
 * through), while `updateMany` with a WHERE guard is atomic.
 */
describe('DriverGoService.verifyStartOtp (M7)', () => {
  const CODE = '654321';
  let job: { id: string; status: string; startOtpHash: string; startOtpAttempts: number };
  let prisma: any;
  let service: DriverGoService;
  const user = { sub: 'usr-driver', role: 'PROVIDER' } as any;

  beforeEach(() => {
    job = { id: 'job-1', status: 'ARRIVED', startOtpHash: hashDriverStartOtp(CODE), startOtpAttempts: 0 };
    prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'drv-1', providerType: 'DRIVER', verificationStatus: 'VERIFIED' }),
      },
      driverBooking: {
        // Stale snapshot, exactly like N concurrent requests reading before any write.
        findFirst: jest.fn().mockImplementation(async () => ({ ...job, customer: { userId: 'usr-c' } })),
        updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const lt = where.startOtpAttempts?.lt;
          if (lt !== undefined && !(job.startOtpAttempts < lt)) return { count: 0 };
          job.startOtpAttempts += data.startOtpAttempts.increment;
          return { count: 1 };
        }),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          Object.assign(job, data);
          return { ...job, customer: { userId: 'usr-c' } };
        }),
      },
    };
    service = new DriverGoService(prisma, { sendPushNotification: jest.fn().mockResolvedValue({}) } as any);
    jest.spyOn(service as any, 'driverFor').mockResolvedValue({ id: 'drv-1' });
    jest.spyOn(service as any, 'notify').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'shapeJob').mockImplementation((j: any) => j);
  });

  const guess = (code: string) =>
    service.verifyStartOtp(user, 'job-1', code).then(
      () => 'ok',
      (e: BadRequestException) => e.message,
    );

  it('20 parallel wrong guesses get exactly 5 real attempts, the rest are locked out', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => guess(String(100000 + i))));

    expect(results.filter((r) => r === 'That start code is not correct.')).toHaveLength(5);
    expect(results.filter((r) => r === 'Too many start-code attempts. Contact support.')).toHaveLength(15);
    expect(job.startOtpAttempts).toBe(5);
  });

  it('the correct code is refused once the 5 attempts are spent', async () => {
    for (let i = 0; i < 5; i++) await guess(`11111${i}`);
    expect(await guess(CODE)).toBe('Too many start-code attempts. Contact support.');
    expect(job.status).toBe('ARRIVED');
  });

  it('spends the attempt BEFORE comparing (atomic increment happens first)', async () => {
    await guess('000000');
    expect(prisma.driverBooking.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', startOtpAttempts: { lt: 5 } },
      data: { startOtpAttempts: { increment: 1 } },
    });
    expect(job.startOtpAttempts).toBe(1);
  });

  it('the right code starts the trip and resets the counter', async () => {
    await guess('222222');
    await guess('333333');
    expect(await guess(CODE)).toBe('ok');
    expect(job.status).toBe('IN_PROGRESS');
    expect(job.startOtpAttempts).toBe(0);
  });

  it('only works after arrival', async () => {
    job.status = 'CONFIRMED';
    expect(await guess(CODE)).toBe('Start code can only be used after arrival.');
    expect(job.startOtpAttempts).toBe(0);
  });

  describe('code format', () => {
    it('accepts 6-digit codes, and 4-digit ones issued before the upgrade', () => {
      expect(DriverStartOtpDto.schema.safeParse({ code: '123456' }).success).toBe(true);
      expect(DriverStartOtpDto.schema.safeParse({ code: '1234' }).success).toBe(true);
    });
    it.each(['12345', '1234567', '12 456', 'abcdef', ''])('rejects %j', (code) => {
      expect(DriverStartOtpDto.schema.safeParse({ code }).success).toBe(false);
    });
  });
});

import { DriverGoCustomerService } from './driver-go-customer.service';

describe('DriverGoCustomerService.getStartCode (M7)', () => {
  it('issues a 6-digit code, stores only its hash, and resets the attempt counter', async () => {
    const stored: { startOtpHash?: string; startOtpAttempts?: number } = {};
    const prisma: any = {
      driverBooking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'job-1', status: 'ARRIVED' }),
        update: jest.fn().mockImplementation(async ({ data }: any) => Object.assign(stored, data)),
      },
    };
    const service = new DriverGoCustomerService(prisma, {} as any);
    const seen = new Set<string>();

    for (let i = 0; i < 40; i++) {
      const { code } = await service.getStartCode({ sub: 'u', customerProfileId: 'cust-1' } as any, 'job-1');
      expect(code).toMatch(/^[1-9]\d{5}$/); // exactly 6 digits, never a leading zero
      expect(stored.startOtpHash).toBe(hashDriverStartOtp(code));
      expect(stored.startOtpHash).not.toContain(code);
      expect(stored.startOtpAttempts).toBe(0);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(30); // not a constant
  });
});
