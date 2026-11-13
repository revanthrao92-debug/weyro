/**
 * Self-contained towing + roadside demo data.
 * Run from packages/database with apps/api/.env loaded:
 *   npx ts-node prisma/seed-assist-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TOW_TITLES = [
  'Car will not start — tow to service',
  'Accident recovery',
  'Flatbed tow to workshop',
  'Highway breakdown tow',
];
const ROADSIDE_TITLES = [
  'Battery jumpstart',
  'Flat tyre on ORR',
  'Fuel delivery',
  'Tyre change at home',
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed demo/development accounts in production. Set NODE_ENV explicitly for non-production environments.',
    );
  }

  const passwordHash = await bcrypt.hash('WeyroDev@2026', 12);

  const customer = await prisma.user.findFirst({
    where: { email: 'prodtest3@weyro.dev' },
    include: { customerProfile: true },
  });
  if (!customer?.customerProfile) {
    throw new Error('Customer prodtest3@weyro.dev not found.');
  }
  const customerId = customer.customerProfile.id;

  let vehicle = await prisma.vehicle.findFirst({
    where: { customerId, make: { not: 'Universal' } },
    orderBy: { createdAt: 'asc' },
  });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        customerId,
        make: 'Hyundai',
        model: 'Creta',
        year: 2022,
        registrationNumber: 'TS09MC4455',
        fuelType: 'PETROL',
      },
    });
  }

  async function ensureProvider(input: {
    email: string;
    phone: string;
    businessName: string;
    providerType: 'TOWING' | 'ROADSIDE';
    description: string;
    towingVehicleTypes?: any[];
    maxVehicleWeightKg?: number;
  }) {
    let user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          passwordHash,
          role: 'PROVIDER',
          emailVerified: true,
          phoneVerified: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, role: 'PROVIDER', isActive: true },
      });
    }

    let provider = await prisma.providerProfile.findUnique({
      where: { userId: user.id },
    });
    if (!provider) {
      provider = await prisma.providerProfile.create({
        data: {
          userId: user.id,
          businessName: input.businessName,
          providerType: input.providerType,
          description: input.description,
          phone: input.phone,
          address: 'Road 12, Banjara Hills, Hyderabad',
          latitude: 17.4126,
          longitude: 78.4392,
          serviceRadiusKm: 25,
          verificationStatus: 'VERIFIED',
          avgRating: 4.8,
          totalReviews: 22,
          completedJobs: 41,
          isAvailable: true,
          towingVehicleTypes: input.towingVehicleTypes,
          maxVehicleWeightKg: input.maxVehicleWeightKg,
          towingBaseFee: input.providerType === 'TOWING' ? 1500 : null,
          towingPerKmFee: input.providerType === 'TOWING' ? 60 : null,
        },
      });
    } else {
      provider = await prisma.providerProfile.update({
        where: { id: provider.id },
        data: {
          businessName: input.businessName,
          providerType: input.providerType,
          verificationStatus: 'VERIFIED',
          isAvailable: true,
          towingVehicleTypes: input.towingVehicleTypes,
          maxVehicleWeightKg: input.maxVehicleWeightKg,
          towingBaseFee: input.providerType === 'TOWING' ? 1500 : null,
          towingPerKmFee: input.providerType === 'TOWING' ? 60 : null,
        },
      });
    }
    return provider;
  }

  const towProvider = await ensureProvider({
    email: 'tow@weyro.dev',
    phone: '+919880033445',
    businessName: 'Rapid Recovery Towing',
    providerType: 'TOWING',
    description: '24/7 flatbed and hook-and-chain recovery across Hyderabad.',
    towingVehicleTypes: ['FLATBED', 'HOOK_AND_CHAIN'],
    maxVehicleWeightKg: 3500,
  });

  const roadsideProvider = await ensureProvider({
    email: 'roadside@weyro.dev',
    phone: '+919880044556',
    businessName: 'Roadside Rescue',
    providerType: 'ROADSIDE',
    description: 'Battery, tyre and fuel assistance at your location.',
  });

  const existing = await prisma.serviceRequest.findMany({
    where: { customerId, title: { in: [...TOW_TITLES, ...ROADSIDE_TITLES] } },
    select: { id: true },
  });
  const ids = existing.map((item) => item.id);
  if (ids.length > 0) {
    await prisma.booking.deleteMany({
      where: { quotation: { requestId: { in: ids } } },
    });
    await prisma.quotation.deleteMany({ where: { requestId: { in: ids } } });
    await prisma.serviceRequest.deleteMany({ where: { id: { in: ids } } });
  }

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  async function createRequest(input: {
    title: string;
    category: 'TOWING' | 'ROADSIDE';
    description: string;
    status: 'OPEN' | 'QUOTES_RECEIVED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED';
    createdHoursAgo: number;
    urgency?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
    roadsideKind?: 'BATTERY' | 'TYRE' | 'FUEL';
    dropoffAddress?: string;
    towingVehicleType?: 'FLATBED' | 'HOOK_AND_CHAIN';
    vehicleWeightKg?: number;
    towingDistanceKm?: number;
    towingEstimatedFare?: number;
  }) {
    return prisma.serviceRequest.create({
      data: {
        customerId,
        vehicleId: vehicle!.id,
        category: input.category,
        title: input.title,
        description: input.description,
        address: '12th Main Road, Indiranagar, Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        urgency: input.urgency ?? 'NORMAL',
        status: input.status,
        isBroadcast: true,
        fulfillmentType:
          input.category === 'TOWING' ? 'TOW_TO_GARAGE' : 'ON_SITE',
        roadsideKind: input.roadsideKind,
        dropoffAddress: input.dropoffAddress,
        dropoffLatitude: input.dropoffAddress ? 12.9352 : undefined,
        dropoffLongitude: input.dropoffAddress ? 77.6245 : undefined,
        towingVehicleType: input.towingVehicleType,
        vehicleWeightKg: input.vehicleWeightKg,
        towingDistanceKm: input.towingDistanceKm,
        towingEstimatedFare: input.towingEstimatedFare,
        expiresAt: new Date(now + 7 * day),
        createdAt: new Date(now - input.createdHoursAgo * hour),
      },
    });
  }

  async function createJob(input: {
    title: string;
    category: 'TOWING' | 'ROADSIDE';
    description: string;
    requestStatus: 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED';
    bookingStatus: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';
    amount: number;
    providerId: string;
    createdAt: Date;
    scheduledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    paymentStatus: 'AUTHORIZED' | 'CAPTURED';
    notes?: string;
    roadsideKind?: 'BATTERY' | 'TYRE' | 'FUEL';
    dropoffAddress?: string;
    towingVehicleType?: 'FLATBED' | 'HOOK_AND_CHAIN';
    vehicleWeightKg?: number;
    towingDistanceKm?: number;
    towingEstimatedFare?: number;
  }) {
    const request = await createRequest({
      title: input.title,
      category: input.category,
      description: input.description,
      status: input.requestStatus,
      createdHoursAgo: Math.max(1, Math.round((now - input.createdAt.getTime()) / hour)),
      roadsideKind: input.roadsideKind,
      dropoffAddress: input.dropoffAddress,
      towingVehicleType: input.towingVehicleType,
      vehicleWeightKg: input.vehicleWeightKg,
      towingDistanceKm: input.towingDistanceKm,
      towingEstimatedFare: input.towingEstimatedFare,
    });

    const quotation = await prisma.quotation.create({
      data: {
        requestId: request.id,
        providerId: input.providerId,
        partsCost: 0,
        labourCost: input.amount,
        totalCost: input.amount,
        warrantyDays: 0,
        etaDescription:
          input.category === 'TOWING' ? '25 minutes to pickup' : '30 minutes on site',
        deliveryMethod: input.category === 'TOWING' ? undefined : 'ON_SITE_FITMENT',
        status: 'ACCEPTED',
      },
    });

    const booking = await prisma.booking.create({
      data: {
        quotationId: quotation.id,
        customerId,
        providerId: input.providerId,
        status: input.bookingStatus,
        scheduledAt: input.scheduledAt,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        completionNotes: input.notes,
        createdAt: input.createdAt,
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: input.amount,
        currency: 'INR',
        status: input.paymentStatus,
        method: 'UPI',
        gatewayPaymentId: `pay_assist_demo_${booking.id.slice(0, 8)}`,
        paidAt: input.createdAt,
        paidToProviderAt:
          input.paymentStatus === 'CAPTURED' ? input.completedAt ?? null : null,
        updatedAt:
          input.paymentStatus === 'AUTHORIZED'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : undefined,
      },
    });

    return booking;
  }

  // Towing demos
  await createRequest({
    title: 'Car will not start — tow to service',
    category: 'TOWING',
    description: 'Battery dead and the car will not start. Needs a flatbed to the workshop.',
    status: 'OPEN',
    createdHoursAgo: 1,
    urgency: 'EMERGENCY',
    dropoffAddress: 'Deccan Auto Care, Banjara Hills, Hyderabad',
    towingVehicleType: 'FLATBED',
    vehicleWeightKg: 1600,
    towingDistanceKm: 8.4,
    towingEstimatedFare: 2200,
  });

  const quotedTow = await createRequest({
    title: 'Accident recovery',
    category: 'TOWING',
    description: 'Front-end damage after a minor collision. Needs recovery to a body shop.',
    status: 'QUOTES_RECEIVED',
    createdHoursAgo: 4,
    urgency: 'URGENT',
    dropoffAddress: 'Apex Body Works, HITEC City, Hyderabad',
    towingVehicleType: 'FLATBED',
    vehicleWeightKg: 1750,
    towingDistanceKm: 12.6,
    towingEstimatedFare: 3200,
  });
  await prisma.quotation.create({
    data: {
      requestId: quotedTow.id,
      providerId: towProvider.id,
      partsCost: 0,
      labourCost: 3200,
      totalCost: 3200,
      warrantyDays: 0,
      etaDescription: '40 minutes to pickup',
      status: 'PENDING',
    },
  });

  const confirmedTow = await createJob({
    title: 'Flatbed tow to workshop',
    category: 'TOWING',
    description: 'Gearbox failure, vehicle is undrivable.',
    requestStatus: 'ACCEPTED',
    bookingStatus: 'CONFIRMED',
    amount: 3600,
    providerId: towProvider.id,
    createdAt: new Date(now - 2 * day),
    scheduledAt: new Date(now + day),
    paymentStatus: 'AUTHORIZED',
    dropoffAddress: 'Deccan Auto Care, Banjara Hills, Hyderabad',
    towingVehicleType: 'FLATBED',
    vehicleWeightKg: 1650,
    towingDistanceKm: 14.2,
    towingEstimatedFare: 3600,
  });

  const completedTow = await createJob({
    title: 'Highway breakdown tow',
    category: 'TOWING',
    description: 'Overheated on the ORR and needed recovery home.',
    requestStatus: 'COMPLETED',
    bookingStatus: 'COMPLETED',
    amount: 4800,
    providerId: towProvider.id,
    createdAt: new Date(now - 5 * day),
    scheduledAt: new Date(now - 4 * day),
    startedAt: new Date(now - 4 * day),
    completedAt: new Date(now - 4 * day + 2 * hour),
    paymentStatus: 'CAPTURED',
    notes: 'Delivered to the customer address, keys handed over.',
    dropoffAddress: '12th Main Road, Indiranagar, Bengaluru',
    towingVehicleType: 'HOOK_AND_CHAIN',
    vehicleWeightKg: 1580,
    towingDistanceKm: 18.5,
    towingEstimatedFare: 4800,
  });

  await prisma.review.create({
    data: {
      bookingId: completedTow.id,
      customerId,
      providerId: towProvider.id,
      rating: 5,
      comment: 'Reached quickly and handled the car carefully.',
    },
  });

  // Roadside demos
  await createRequest({
    title: 'Battery jumpstart',
    category: 'ROADSIDE',
    description: 'Battery drained after parking with lights on.',
    status: 'OPEN',
    createdHoursAgo: 1,
    urgency: 'EMERGENCY',
    roadsideKind: 'BATTERY',
  });

  const quotedRoadside = await createRequest({
    title: 'Flat tyre on ORR',
    category: 'ROADSIDE',
    description: 'Front-left tyre punctured on the outer ring road.',
    status: 'QUOTES_RECEIVED',
    createdHoursAgo: 3,
    urgency: 'URGENT',
    roadsideKind: 'TYRE',
  });
  await prisma.quotation.create({
    data: {
      requestId: quotedRoadside.id,
      providerId: roadsideProvider.id,
      partsCost: 0,
      labourCost: 950,
      totalCost: 950,
      warrantyDays: 0,
      etaDescription: '30 minutes on site',
      deliveryMethod: 'ON_SITE_FITMENT',
      status: 'PENDING',
    },
  });

  await createJob({
    title: 'Fuel delivery',
    category: 'ROADSIDE',
    description: 'Ran out of petrol near Gachibowli.',
    requestStatus: 'IN_PROGRESS',
    bookingStatus: 'IN_PROGRESS',
    amount: 750,
    providerId: roadsideProvider.id,
    createdAt: new Date(now - 5 * hour),
    scheduledAt: new Date(now - 90 * 60 * 1000),
    startedAt: new Date(now - 40 * 60 * 1000),
    paymentStatus: 'AUTHORIZED',
    roadsideKind: 'FUEL',
  });

  const completedRoadside = await createJob({
    title: 'Tyre change at home',
    category: 'ROADSIDE',
    description: 'Spare wheel needed fitting at home.',
    requestStatus: 'COMPLETED',
    bookingStatus: 'COMPLETED',
    amount: 1100,
    providerId: roadsideProvider.id,
    createdAt: new Date(now - 6 * day),
    scheduledAt: new Date(now - 5 * day),
    startedAt: new Date(now - 5 * day),
    completedAt: new Date(now - 5 * day + hour),
    paymentStatus: 'CAPTURED',
    notes: 'Spare fitted and tyre pressure checked.',
    roadsideKind: 'TYRE',
  });

  await prisma.review.create({
    data: {
      bookingId: completedRoadside.id,
      customerId,
      providerId: roadsideProvider.id,
      rating: 5,
      comment: 'Came home and finished in 20 minutes.',
    },
  });

  await prisma.providerProfile.update({
    where: { id: towProvider.id },
    data: { completedJobs: 42, avgRating: 4.8, totalReviews: 23 },
  });
  await prisma.providerProfile.update({
    where: { id: roadsideProvider.id },
    data: { completedJobs: 33, avgRating: 4.9, totalReviews: 19 },
  });

  console.log('Assist demo data ready');
  console.log('  towing:   tow@weyro.dev / WeyroDev@2026');
  console.log('  roadside: roadside@weyro.dev / WeyroDev@2026');
  console.log('  towing jobs: open, quoted, confirmed, completed');
  console.log('  roadside jobs: open, quoted, in progress, completed');
  console.log('  confirmed tow:', confirmedTow.id);
}

main()
  .catch((error) => {
    console.error(error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
