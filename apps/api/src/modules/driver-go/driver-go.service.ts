import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { verifyDriverStartOtp } from './driver-otp';
import { PLATFORM_COMMISSION } from './driver-pricing';
import { canTransitionDriverJob, type DriverJobStatus } from './driver-state';
import { istDayStart, istMonthStart, istWeekStart } from '../../common/utils/ist-day';
import type {
  DeclineDriverJobDto,
  DriverAvailabilityDto,
  DriverJobStatusDto,
} from './dto/driver-go.dto';

const JOB_INCLUDE = {
  customer: {
    include: {
      user: { select: { phone: true } },
    },
  },
  vehicle: {
    select: {
      make: true,
      model: true,
      year: true,
      registrationNumber: true,
      transmission: true,
      fuelType: true,
    },
  },
} as const;

/** Wrong start-code guesses allowed per booking before it locks. */
const MAX_START_OTP_ATTEMPTS = 5;

/** Trips still in play: a request to answer or a trip not yet finished. */
const OPEN_STATUSES: DriverJobStatus[] = ['REQUESTED', 'CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];

@Injectable()
export class DriverGoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async driverFor(user: AuthUserPayload) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId: user.sub },
      include: {
        driverProfile: { include: { availability: true } },
        user: { select: { email: true, phone: true } },
      },
    });

    if (!provider || provider.providerType !== 'DRIVER') {
      throw new ForbiddenException('Driver profile required');
    }
    if (!provider.driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }
    return provider;
  }

  private maskPhone(phone?: string | null) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : '••••';
  }

  private shapeJob(job: any) {
    return {
      id: job.id,
      status: job.status,
      engagement: job.engagement,
      scheduleMode: job.scheduleMode,
      pickupAddress: job.pickupAddress,
      pickupLatitude: job.pickupLatitude,
      pickupLongitude: job.pickupLongitude,
      destinationAddress: job.destinationAddress,
      destinationLatitude: job.destinationLatitude,
      destinationLongitude: job.destinationLongitude,
      startAt: job.startAt,
      endAt: job.endAt,
      durationHours: job.durationHours,
      durationDays: job.durationDays,
      notes: job.notes,
      transmission: job.transmission,
      totalAmount: Number(job.totalAmount),
      driverEarning: Number(job.driverEarning),
      platformFee: Number(job.platformFee),
      acceptedAt: job.acceptedAt,
      enRouteAt: job.enRouteAt,
      arrivedAt: job.arrivedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      cancelledAt: job.cancelledAt,
      cancellationReason: job.cancellationReason,
      customer: {
        firstName: job.customer?.firstName ?? 'Customer',
        lastName: job.customer?.lastName ?? '',
        phoneMasked: this.maskPhone(job.customer?.user?.phone),
      },
      vehicle: job.vehicle
        ? {
            make: job.vehicle.make,
            model: job.vehicle.model,
            year: job.vehicle.year,
            registrationNumber: job.vehicle.registrationNumber,
            transmission: job.vehicle.transmission,
            fuelType: job.vehicle.fuelType,
          }
        : null,
    };
  }

  async getMe(user: AuthUserPayload) {
    const provider = await this.driverFor(user);
    const driver = provider.driverProfile!;
    const today = istDayStart();

    const [upcoming, completedToday, earningsToday] = await Promise.all([
      this.prisma.driverBooking.count({
        where: {
          driverId: provider.id,
          deletedAt: null,
          status: {
            in: ['REQUESTED', 'CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'],
          },
        },
      }),
      this.prisma.driverBooking.count({
        where: {
          driverId: provider.id,
          status: 'COMPLETED',
          completedAt: { gte: today },
        },
      }),
      this.prisma.driverBooking.aggregate({
        where: {
          driverId: provider.id,
          status: 'COMPLETED',
          completedAt: { gte: today },
        },
        _sum: { driverEarning: true },
      }),
    ]);

    return {
      id: provider.id,
      businessName: provider.businessName,
      phone: provider.phone,
      email: provider.user?.email,
      verificationStatus: provider.verificationStatus,
      isOnline: driver.isOnline,
      avgRating: provider.avgRating,
      totalReviews: provider.totalReviews,
      completedJobs: provider.completedJobs,
      driver: {
        licenceNumber: driver.licenceNumber,
        licenceExpiry: driver.licenceExpiry,
        experienceYears: driver.experienceYears,
        languages: driver.languages,
        transmissions: driver.transmissions,
        hourlyRate: Number(driver.hourlyRate),
        dailyRate: Number(driver.dailyRate),
        maxHoursPerDay: driver.maxHoursPerDay,
      },
      availability: driver.availability
        .slice()
        .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute),
      stats: {
        upcoming,
        completedToday,
        earningsToday: Number(earningsToday._sum.driverEarning ?? 0),
      },
    };
  }

  async setOnline(user: AuthUserPayload, isOnline: boolean) {
    const provider = await this.driverFor(user);
    if (isOnline && provider.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException(
        'Your driver verification must be approved before going online.',
      );
    }
    await this.prisma.driverProfile.update({
      where: { providerId: provider.id },
      data: { isOnline },
    });
    return { isOnline };
  }

  async getAvailability(user: AuthUserPayload) {
    const provider = await this.driverFor(user);
    return {
      rules: provider.driverProfile!.availability
        .slice()
        .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute),
    };
  }

  async setAvailability(user: AuthUserPayload, dto: DriverAvailabilityDto) {
    const provider = await this.driverFor(user);
    const rules = [...dto.rules].sort(
      (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute,
    );

    for (let i = 1; i < rules.length; i += 1) {
      if (
        rules[i].weekday === rules[i - 1].weekday &&
        rules[i].startMinute < rules[i - 1].endMinute
      ) {
        throw new BadRequestException(
          'Availability windows cannot overlap on the same day.',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.driverAvailability.deleteMany({
        where: { driverId: provider.driverProfile!.id },
      }),
      this.prisma.driverAvailability.createMany({
        data: rules.map((rule) => ({
          driverId: provider.driverProfile!.id,
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
        })),
      }),
    ]);

    return this.getAvailability(user);
  }

  async getJobs(user: AuthUserPayload, status?: DriverJobStatus) {
    const provider = await this.driverFor(user);
    const base = { driverId: provider.id, deletedAt: null };
    if (status) {
      // Open trips: soonest first. Finished ones: newest first, so the latest 100 show.
      const open = OPEN_STATUSES.includes(status);
      const jobs = await this.prisma.driverBooking.findMany({
        where: { ...base, status },
        include: JOB_INCLUDE,
        orderBy: [{ startAt: open ? 'asc' : 'desc' }],
        take: 100,
      });
      return { items: jobs.map((job) => this.shapeJob(job)) };
    }
    // Every open trip (requests and upcoming, soonest first) plus the latest 50
    // finished ones. One list of the OLDEST 100 used to fill up with history and
    // hide new requests once a driver had done 100 trips.
    const [open, finished] = await Promise.all([
      this.prisma.driverBooking.findMany({
        where: { ...base, status: { in: OPEN_STATUSES } },
        include: JOB_INCLUDE,
        orderBy: [{ startAt: 'asc' }],
        take: 100,
      }),
      this.prisma.driverBooking.findMany({
        where: { ...base, status: { notIn: OPEN_STATUSES } },
        include: JOB_INCLUDE,
        orderBy: [{ startAt: 'desc' }],
        take: 50,
      }),
    ]);
    return { items: [...open, ...finished].map((job) => this.shapeJob(job)) };
  }

  async getJob(user: AuthUserPayload, id: string) {
    const provider = await this.driverFor(user);
    const job = await this.prisma.driverBooking.findFirst({
      where: { id, driverId: provider.id, deletedAt: null },
      include: JOB_INCLUDE,
    });
    if (!job) throw new NotFoundException('Trip not found.');
    return this.shapeJob(job);
  }

  private async notify(
    userId: string | undefined,
    title: string,
    body: string,
    data: Record<string, string>,
  ) {
    if (!userId) return;
    try {
      await this.notifications.sendPushNotification({
        userId,
        title,
        body,
        data,
      });
    } catch {
      // Notifications must never block a booking transition.
    }
  }

  async accept(user: AuthUserPayload, id: string) {
    const provider = await this.driverFor(user);
    if (provider.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException('Your account is not verified yet.');
    }

    const result = await this.prisma.driverBooking.updateMany({
      where: { id, driverId: provider.id, status: 'REQUESTED', deletedAt: null },
      data: { status: 'CONFIRMED', acceptedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException('This trip is no longer available.');
    }

    const job = await this.prisma.driverBooking.findUniqueOrThrow({
      where: { id },
      include: JOB_INCLUDE,
    });
    await this.notify(
      job.customer?.userId,
      'Driver confirmed',
      `${provider.businessName} accepted your Driver Go booking.`,
      { type: 'DRIVER_JOB_ACCEPTED', driverBookingId: id },
    );
    return this.shapeJob(job);
  }

  async decline(user: AuthUserPayload, id: string, dto: DeclineDriverJobDto) {
    const provider = await this.driverFor(user);
    const result = await this.prisma.driverBooking.updateMany({
      where: { id, driverId: provider.id, status: 'REQUESTED', deletedAt: null },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: dto.reason?.trim() || 'Declined by driver',
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This trip is no longer available.');
    }
    const job = await this.prisma.driverBooking.findUniqueOrThrow({
      where: { id },
      include: JOB_INCLUDE,
    });
    await this.notify(
      job.customer?.userId,
      'Driver unavailable',
      'Your Driver Go request was declined. Please choose another driver.',
      { type: 'DRIVER_JOB_DECLINED', driverBookingId: id },
    );
    return this.shapeJob(job);
  }

  async updateStatus(user: AuthUserPayload, id: string, dto: DriverJobStatusDto) {
    const provider = await this.driverFor(user);
    const job = await this.prisma.driverBooking.findFirst({
      where: { id, driverId: provider.id, deletedAt: null },
      include: JOB_INCLUDE,
    });
    if (!job) throw new NotFoundException('Trip not found.');

    const current = job.status as DriverJobStatus;
    const next = dto.status as DriverJobStatus;
    if (!canTransitionDriverJob(current, next)) {
      throw new BadRequestException(
        `Cannot move a ${current.toLowerCase()} job to ${next.toLowerCase()}.`,
      );
    }

    const now = new Date();
    const data: Record<string, unknown> = { status: next };
    if (next === 'DRIVER_EN_ROUTE') data.enRouteAt = now;
    if (next === 'ARRIVED') data.arrivedAt = now;
    if (next === 'COMPLETED') data.completedAt = now;

    const updated = await this.prisma.$transaction(async (tx) => {
      // M2: compare-and-set on the status we validated the transition against.
      const claimed = await tx.driverBooking.updateMany({
        where: { id, driverId: provider.id, status: current as never },
        data: data as never,
      });
      if (claimed.count === 0) {
        throw new ConflictException('This trip just changed. Refresh and try again.');
      }
      const result = await tx.driverBooking.findUniqueOrThrow({
        where: { id },
        include: JOB_INCLUDE,
      });
      if (next === 'COMPLETED') {
        await tx.providerProfile.update({
          where: { id: provider.id },
          data: { completedJobs: { increment: 1 } },
        });
      }
      return result;
    });

    const messages: Record<string, { title: string; body: string }> = {
      DRIVER_EN_ROUTE: {
        title: 'Driver on the way',
        body: `${provider.businessName} is heading to your pickup point.`,
      },
      ARRIVED: {
        title: 'Driver arrived',
        body: `${provider.businessName} is at your pickup point. Share your start code.`,
      },
      COMPLETED: {
        title: 'Trip completed',
        body: 'Your Driver Go trip is complete. Please leave a review.',
      },
    };
    const message = messages[next];
    if (message) {
      await this.notify(updated.customer?.userId, message.title, message.body, {
        type: `DRIVER_JOB_${next}`,
        driverBookingId: id,
      });
    }
    return this.shapeJob(updated);
  }

  async verifyStartOtp(user: AuthUserPayload, id: string, code: string) {
    const provider = await this.driverFor(user);
    const job = await this.prisma.driverBooking.findFirst({
      where: { id, driverId: provider.id, deletedAt: null },
      include: JOB_INCLUDE,
    });
    if (!job) throw new NotFoundException('Trip not found.');
    if (job.status !== 'ARRIVED') {
      throw new BadRequestException('Start code can only be used after arrival.');
    }
    // M7: spend an attempt BEFORE comparing, atomically. A conditional
    // increment (attempts < 5) means N parallel guesses can never get more
    // than 5 tries in total — a read-check-then-increment would let them all
    // pass the check at once.
    const attempt = await this.prisma.driverBooking.updateMany({
      where: { id, startOtpAttempts: { lt: MAX_START_OTP_ATTEMPTS } },
      data: { startOtpAttempts: { increment: 1 } },
    });
    if (attempt.count === 0) {
      throw new BadRequestException(
        'Too many start-code attempts. Contact support.',
      );
    }
    if (!verifyDriverStartOtp(code, job.startOtpHash)) {
      throw new BadRequestException('That start code is not correct.');
    }

    // M2: only start a trip that is still ARRIVED (it may have been cancelled
    // between the code check and this write).
    const started = await this.prisma.driverBooking.updateMany({
      where: { id, status: 'ARRIVED' },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        startOtpAttempts: 0,
      },
    });
    if (started.count === 0) {
      throw new ConflictException('This trip just changed. Refresh and try again.');
    }
    const updated = await this.prisma.driverBooking.findUniqueOrThrow({
      where: { id },
      include: JOB_INCLUDE,
    });
    await this.notify(
      updated.customer?.userId,
      'Trip started',
      'Your Driver Go trip has started. Stay safe.',
      { type: 'DRIVER_JOB_STARTED', driverBookingId: id },
    );
    return this.shapeJob(updated);
  }

  async getEarnings(user: AuthUserPayload) {
    const provider = await this.driverFor(user);
    const jobs = await this.prisma.driverBooking.findMany({
      where: {
        driverId: provider.id,
        deletedAt: null,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      include: JOB_INCLUDE,
      orderBy: { completedAt: 'desc' },
      take: 100,
    });

    const now = new Date();
    const dayStart = istDayStart(now);
    const weekStart = istWeekStart(now);
    const monthStart = istMonthStart(now);

    // Totals come from the database over ALL trips in the period; the list
    // above is only the latest 100 for display (a busy month passes 100).
    const total = async (from: Date) => {
      const sum = await this.prisma.driverBooking.aggregate({
        where: { driverId: provider.id, deletedAt: null, status: 'COMPLETED', completedAt: { gte: from } },
        _sum: { driverEarning: true },
      });
      return Number(sum._sum.driverEarning ?? 0);
    };
    const [today, week, month] = await Promise.all([total(dayStart), total(weekStart), total(monthStart)]);

    return {
      today,
      week,
      month,
      platformFeeRate: PLATFORM_COMMISSION,
      trips: jobs.map((job) => this.shapeJob(job)),
    };
  }
}
