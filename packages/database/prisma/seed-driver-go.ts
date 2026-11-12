/**
 * Driver Go pilot seed.
 *
 * Creates one verified driver + sample jobs against the existing test customer.
 * Safe to rerun: the driver, profile and availability are upserted; the
 * driver's sample bookings are replaced.
 *
 * Run (from packages/database, with apps/api/.env exported):
 *   npx ts-node prisma/seed-driver-go.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const OTP_SECRET =
  process.env.OTP_HASH_SECRET || 'weyro_dev_otp_hash_secret_32_chars_x';

function startOtpHash(code: string) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`driver-start:${code}`)
    .digest('hex');
}

function atTime(hour: number, dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  const customerUser = await prisma.user.findFirst({
    where: { email: 'prodtest3@weyro.dev' },
    include: { customerProfile: { include: { vehicles: true } } },
  });
  if (!customerUser?.customerProfile) {
    throw new Error(
      'Seed customer prodtest3@weyro.dev not found. Run the main seed first.',
    );
  }
  const customer = customerUser.customerProfile;
  let vehicle =
    customer.vehicles.find((item) => item.make !== 'Universal') ??
    customer.vehicles[0];
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        customerId: customer.id,
        make: 'Maruti',
        model: 'Swift',
        year: 2022,
        registrationNumber: 'TS09DG0001',
        fuelType: 'PETROL',
        transmission: 'MANUAL',
      },
    });
  }

  const passwordHash = await bcrypt.hash('DriverGo123', 12);
  const driverUser = await prisma.user.upsert({
    where: { email: 'driver1@weyro.dev' },
    update: {
      passwordHash,
      role: 'PROVIDER',
      phoneVerified: true,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: 'driver1@weyro.dev',
      phone: '+919876500101',
      passwordHash,
      role: 'PROVIDER',
      phoneVerified: true,
      emailVerified: true,
    },
  });

  const provider = await prisma.providerProfile.upsert({
    where: { userId: driverUser.id },
    update: {
      businessName: 'Arjun Rao',
      providerType: 'DRIVER',
      description: 'Professional driver · Hyderabad',
      phone: '+919876500101',
      address: 'Madhapur, Hyderabad',
      latitude: 17.4483,
      longitude: 78.3915,
      serviceRadiusKm: 25,
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedBy: 'pilot-seed',
      isAvailable: true,
      completedJobs: 1,
      deletedAt: null,
    },
    create: {
      userId: driverUser.id,
      businessName: 'Arjun Rao',
      providerType: 'DRIVER',
      description: 'Professional driver · Hyderabad',
      phone: '+919876500101',
      address: 'Madhapur, Hyderabad',
      latitude: 17.4483,
      longitude: 78.3915,
      serviceRadiusKm: 25,
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedBy: 'pilot-seed',
      isAvailable: true,
      completedJobs: 1,
    },
  });

  const driver = await prisma.driverProfile.upsert({
    where: { providerId: provider.id },
    update: {
      licenceNumber: 'TS0920180001234',
      licenceExpiry: new Date('2032-05-01'),
      experienceYears: 8,
      languages: ['English', 'Hindi', 'Telugu'],
      transmissions: ['MANUAL', 'AUTOMATIC'],
      hourlyRate: 299,
      dailyRate: 1799,
      isOnline: true,
      maxHoursPerDay: 10,
    },
    create: {
      providerId: provider.id,
      licenceNumber: 'TS0920180001234',
      licenceExpiry: new Date('2032-05-01'),
      experienceYears: 8,
      languages: ['English', 'Hindi', 'Telugu'],
      transmissions: ['MANUAL', 'AUTOMATIC'],
      hourlyRate: 299,
      dailyRate: 1799,
      isOnline: true,
      maxHoursPerDay: 10,
    },
  });

  await prisma.driverAvailability.deleteMany({ where: { driverId: driver.id } });
  await prisma.driverAvailability.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      driverId: driver.id,
      weekday,
      startMinute: 8 * 60,
      endMinute: 20 * 60,
    })),
  });

  await prisma.driverBooking.deleteMany({ where: { driverId: provider.id } });

  const hourlyBase = 299 * 4;
  const dailyBase = 1799;
  const commission = (base: number) => Number((base * 0.18).toFixed(2));

  await prisma.driverBooking.create({
    data: {
      customerId: customer.id,
      driverId: provider.id,
      vehicleId: vehicle.id,
      status: 'REQUESTED',
      engagement: 'HOURLY',
      scheduleMode: 'SCHEDULED',
      pickupAddress: 'HITEC City, Hyderabad',
      pickupLatitude: 17.4435,
      pickupLongitude: 78.3772,
      destinationAddress: 'Banjara Hills, Hyderabad',
      startAt: atTime(10, 1),
      endAt: atTime(14, 1),
      durationHours: 4,
      notes: 'Office drop and a couple of errands.',
      transmission: 'MANUAL',
      baseAmount: hourlyBase,
      platformFee: commission(hourlyBase),
      totalAmount: hourlyBase,
      driverEarning: Number((hourlyBase - commission(hourlyBase)).toFixed(2)),
      startOtpHash: startOtpHash('1234'),
    },
  });

  await prisma.driverBooking.create({
    data: {
      customerId: customer.id,
      driverId: provider.id,
      vehicleId: vehicle.id,
      status: 'CONFIRMED',
      engagement: 'DAILY',
      scheduleMode: 'SCHEDULED',
      pickupAddress: 'Gachibowli, Hyderabad',
      pickupLatitude: 17.4401,
      pickupLongitude: 78.3489,
      startAt: atTime(14, 1),
      endAt: atTime(24, 1),
      durationDays: 1,
      transmission: 'MANUAL',
      baseAmount: dailyBase,
      platformFee: commission(dailyBase),
      totalAmount: dailyBase,
      driverEarning: Number((dailyBase - commission(dailyBase)).toFixed(2)),
      startOtpHash: startOtpHash('1234'),
    },
  });

  const completedBase = 299 * 3;
  await prisma.driverBooking.create({
    data: {
      customerId: customer.id,
      driverId: provider.id,
      vehicleId: vehicle.id,
      status: 'COMPLETED',
      engagement: 'HOURLY',
      scheduleMode: 'SCHEDULED',
      pickupAddress: 'Jubilee Hills, Hyderabad',
      pickupLatitude: 17.4325,
      pickupLongitude: 78.4073,
      startAt: atTime(10, -1),
      endAt: atTime(13, -1),
      durationHours: 3,
      transmission: 'MANUAL',
      baseAmount: completedBase,
      platformFee: commission(completedBase),
      totalAmount: completedBase,
      driverEarning: Number((completedBase - commission(completedBase)).toFixed(2)),
      startOtpHash: null,
      acceptedAt: atTime(9, -1),
      enRouteAt: atTime(9, -1),
      arrivedAt: atTime(10, -1),
      startedAt: atTime(10, -1),
      completedAt: atTime(13, -1),
    },
  });

  console.log('Driver Go seed complete');
  console.log('  email:    driver1@weyro.dev');
  console.log('  password: TestPass123!');
  console.log('  provider:', provider.id);
  console.log('  driver:  ', driver.id);
  console.log('  start code for seeded jobs: 1234');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
