import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { hashDriverStartOtp } from './driver-otp';
import {
  rangesOverlap,
  windowFitsAvailability,
} from './driver-availability';
import {
  calculateDriverFare,
  driverBookingEnd,
  round2,
} from './driver-pricing';
import type {
  AvailableDriversQuery,
  CreateDriverBookingInput,
} from './dto/customer.dto';

const DRIVER_INCLUDE = {
  driverProfile: { include: { availability: true } },
  user: { select: { id: true } },
} as const;

const BOOKING_INCLUDE = {
  driver: { include: DRIVER_INCLUDE },
  vehicle: {
    select: {
      id: true,
      make: true,
      model: true,
      year: true,
      registrationNumber: true,
      transmission: true,
      fuelType: true,
    },
  },
} as const;

const ACTIVE_BOOKING_STATUSES = [
  'REQUESTED',
  'CONFIRMED',
  'DRIVER_EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
] as const;

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

@Injectable()
export class DriverGoCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private customerId(user: AuthUserPayload) {
    if (!user.customerProfileId) {
      throw new ForbiddenException('Customer profile required');
    }
    return user.customerProfileId;
  }

  private parseStart(value: string): Date {
    const startAt = new Date(value);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid start time');
    }
    if (startAt.getTime() < Date.now() + 30 * 60 * 1000) {
      throw new BadRequestException('Choose a start time at least 30 minutes away');
    }
    return startAt;
  }

  private shapeDriver(provider: any, quote: number, distanceKm: number | null) {
    const driver = provider.driverProfile;
    return {
      id: provider.id,
      name: provider.businessName,
      description: provider.description,
      rating: provider.avgRating,
      totalReviews: provider.totalReviews,
      completedJobs: provider.completedJobs,
      experienceYears: driver.experienceYears,
      languages: driver.languages,
      transmissions: driver.transmissions,
      hourlyRate: Number(driver.hourlyRate),
      dailyRate: Number(driver.dailyRate),
      distanceKm: distanceKm === null ? null : round2(distanceKm),
      quote,
    };
  }

  private shapeBooking(booking: any) {
    const driver = booking.driver;
    return {
      id: booking.id,
      status: booking.status,
      engagement: booking.engagement,
      scheduleMode: booking.scheduleMode,
      pickupAddress: booking.pickupAddress,
      pickupLatitude: booking.pickupLatitude,
      pickupLongitude: booking.pickupLongitude,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationHours: booking.durationHours,
      durationDays: booking.durationDays,
      notes: booking.notes,
      transmission: booking.transmission,
      totalAmount: Number(booking.totalAmount),
      canCancel: ['REQUESTED', 'CONFIRMED'].includes(booking.status),
      startCodeAvailable: booking.status === 'ARRIVED',
      cancelledAt: booking.cancelledAt,
      cancellationReason: booking.cancellationReason,
      createdAt: booking.createdAt,
      driver: {
        id: driver.id,
        name: driver.businessName,
        rating: driver.avgRating,
        totalReviews: driver.totalReviews,
        completedJobs: driver.completedJobs,
        experienceYears: driver.driverProfile?.experienceYears ?? 0,
        languages: driver.driverProfile?.languages ?? [],
        transmissions: driver.driverProfile?.transmissions ?? [],
      },
      vehicle: booking.vehicle,
    };
  }

  async listDrivers(user: AuthUserPayload, query: AvailableDriversQuery) {
    this.customerId(user);
    const startAt = this.parseStart(query.startAt);
    const endAt = driverBookingEnd(
      query.engagement,
      startAt,
      query.durationHours,
      query.durationDays,
    );

    const providers = await this.prisma.providerProfile.findMany({
      where: {
        providerType: 'DRIVER',
        verificationStatus: 'VERIFIED',
        deletedAt: null,
      },
      include: DRIVER_INCLUDE,
    });

    const conflicts = await this.prisma.driverBooking.findMany({
      where: {
        deletedAt: null,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { driverId: true },
    });
    const busy = new Set(conflicts.map((item) => item.driverId));

    const pickup =
      query.lat !== undefined && query.lng !== undefined
        ? { latitude: query.lat, longitude: query.lng }
        : null;

    const items = providers
      .map((provider) => {
        const driver = provider.driverProfile;
        if (!driver || busy.has(provider.id)) return null;
        if (!windowFitsAvailability(driver.availability, startAt, endAt)) {
          return null;
        }
        if (
          query.transmission &&
          !driver.transmissions.includes(query.transmission)
        ) {
          return null;
        }

        let distanceKm: number | null = null;
        if (pickup) {
          distanceKm = haversineKm(pickup, {
            latitude: provider.latitude,
            longitude: provider.longitude,
          });
          if (distanceKm > provider.serviceRadiusKm) return null;
        }

        const fare = calculateDriverFare({
          engagement: query.engagement,
          hourlyRate: Number(driver.hourlyRate),
          dailyRate: Number(driver.dailyRate),
          durationHours: query.durationHours,
          durationDays: query.durationDays,
          startAt,
        });

        return {
          ...this.shapeDriver(provider, fare.totalAmount, distanceKm),
          endAt: fare.endAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a!.distanceKm !== null && b!.distanceKm !== null) {
          return a!.distanceKm - b!.distanceKm;
        }
        return b!.rating - a!.rating;
      });

    return { items };
  }

  async createBooking(user: AuthUserPayload, dto: CreateDriverBookingInput) {
    const customerId = this.customerId(user);
    const startAt = this.parseStart(dto.startAt);
    const endAt = driverBookingEnd(
      dto.engagement,
      startAt,
      dto.durationHours,
      dto.durationDays,
    );

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, customerId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const provider = await this.prisma.providerProfile.findFirst({
      where: {
        id: dto.driverId,
        providerType: 'DRIVER',
        verificationStatus: 'VERIFIED',
        deletedAt: null,
      },
      include: DRIVER_INCLUDE,
    });
    if (!provider?.driverProfile) {
      throw new NotFoundException('Driver not found');
    }
    const driver = provider.driverProfile;

    if (!windowFitsAvailability(driver.availability, startAt, endAt)) {
      throw new BadRequestException(
        'This driver is not available for the selected time.',
      );
    }

    const transmission = dto.transmission ?? vehicle.transmission ?? undefined;
    if (
      transmission &&
      !driver.transmissions.includes(transmission as 'MANUAL' | 'AUTOMATIC')
    ) {
      throw new BadRequestException(
        'This driver cannot drive that transmission.',
      );
    }

    const fare = calculateDriverFare({
      engagement: dto.engagement,
      hourlyRate: Number(driver.hourlyRate),
      dailyRate: Number(driver.dailyRate),
      durationHours: dto.durationHours,
      durationDays: dto.durationDays,
      startAt,
    });

    const booking = await this.prisma.$transaction(
      async (tx) => {
        const conflict = await tx.driverBooking.findFirst({
          where: {
            driverId: provider.id,
            deletedAt: null,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException(
            'That driver was just booked for this time.',
          );
        }

        return tx.driverBooking.create({
          data: {
            customerId,
            driverId: provider.id,
            vehicleId: vehicle.id,
            status: 'REQUESTED',
            engagement: dto.engagement,
            scheduleMode: dto.scheduleMode,
            pickupAddress: dto.pickupAddress,
            pickupLatitude: dto.pickupLatitude,
            pickupLongitude: dto.pickupLongitude,
            startAt,
            endAt,
            durationHours: dto.durationHours,
            durationDays: dto.durationDays,
            notes: dto.notes,
            transmission: transmission as 'MANUAL' | 'AUTOMATIC' | undefined,
            baseAmount: fare.baseAmount,
            platformFee: fare.platformFee,
            totalAmount: fare.totalAmount,
            driverEarning: fare.driverEarning,
          },
          include: BOOKING_INCLUDE,
        });
      },
      { isolationLevel: 'Serializable' },
    );

    if (provider.user?.id) {
      this.notifications
        .sendPushNotification({
          userId: provider.user.id,
          title: 'New Driver Go request',
          body: `${dto.pickupAddress} · ${dto.engagement === 'HOURLY' ? `${dto.durationHours} hours` : `${dto.durationDays} day`}`,
          data: { type: 'DRIVER_JOB_REQUESTED', driverBookingId: booking.id },
        })
        .catch(() => {});
    }

    return this.shapeBooking(booking);
  }

  async listBookings(user: AuthUserPayload) {
    const customerId = this.customerId(user);
    const bookings = await this.prisma.driverBooking.findMany({
      where: { customerId, deletedAt: null },
      include: BOOKING_INCLUDE,
      orderBy: { startAt: 'desc' },
      take: 50,
    });
    return { items: bookings.map((booking) => this.shapeBooking(booking)) };
  }

  async getBooking(user: AuthUserPayload, id: string) {
    const customerId = this.customerId(user);
    const booking = await this.prisma.driverBooking.findFirst({
      where: { id, customerId, deletedAt: null },
      include: BOOKING_INCLUDE,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.shapeBooking(booking);
  }

  async cancelBooking(user: AuthUserPayload, id: string) {
    const customerId = this.customerId(user);
    const booking = await this.prisma.driverBooking.findFirst({
      where: { id, customerId, deletedAt: null },
      include: BOOKING_INCLUDE,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['REQUESTED', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException(
        'This booking can no longer be cancelled online. Contact support.',
      );
    }

    const updated = await this.prisma.driverBooking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled by customer',
      },
      include: BOOKING_INCLUDE,
    });

    if (booking.driver.user?.id) {
      this.notifications
        .sendPushNotification({
          userId: booking.driver.user.id,
          title: 'Driver Go booking cancelled',
          body: 'The customer cancelled this booking.',
          data: { type: 'DRIVER_JOB_CANCELLED', driverBookingId: id },
        })
        .catch(() => {});
    }

    return this.shapeBooking(updated);
  }

  async getStartCode(user: AuthUserPayload, id: string) {
    const customerId = this.customerId(user);
    const booking = await this.prisma.driverBooking.findFirst({
      where: { id, customerId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'ARRIVED') {
      throw new BadRequestException(
        'The start code is available once the driver arrives.',
      );
    }

    const code = String(randomInt(1000, 10000));
    await this.prisma.driverBooking.update({
      where: { id },
      data: {
        startOtpHash: hashDriverStartOtp(code),
        startOtpAttempts: 0,
      },
    });
    return { code };
  }
}
