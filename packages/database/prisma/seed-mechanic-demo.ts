/**
 * Self-contained mechanic/garage demo data.
 * Run from packages/database with apps/api/.env loaded:
 *   npx ts-node prisma/seed-mechanic-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEMO_TITLES = [
  'Brake pad replacement',
  'Periodic service',
  'Suspension inspection',
  'Clutch adjustment',
  'Clutch noise diagnosis',
  'AC cooling check',
];

async function main() {
  const passwordHash = await bcrypt.hash('WeyroDev@2026', 12);

  let user = await prisma.user.findUnique({
    where: { email: 'workshop@weyro.dev' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'workshop@weyro.dev',
        phone: '+919880022334',
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
        businessName: 'Deccan Auto Care',
        providerType: 'GARAGE',
        description:
          'Independent multi-brand workshop for repair, scheduled service and diagnostics.',
        phone: '+919880022334',
        address: 'Road 12, Banjara Hills, Hyderabad',
        latitude: 17.4126,
        longitude: 78.4392,
        serviceRadiusKm: 25,
        verificationStatus: 'VERIFIED',
        avgRating: 4.7,
        totalReviews: 18,
        completedJobs: 24,
        isAvailable: true,
      },
    });
  } else {
    provider = await prisma.providerProfile.update({
      where: { id: provider.id },
      data: {
        businessName: 'Deccan Auto Care',
        providerType: 'GARAGE',
        verificationStatus: 'VERIFIED',
        isAvailable: true,
        completedJobs: 24,
      },
    });
  }

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

  const existing = await prisma.serviceRequest.findMany({
    where: { customerId, title: { in: DEMO_TITLES } },
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

  async function createRequest(data: {
    title: string;
    category: 'REPAIR' | 'MAINTENANCE' | 'INSPECTION';
    description: string;
    status: 'OPEN' | 'QUOTES_RECEIVED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    createdHoursAgo: number;
    urgency?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  }) {
    return prisma.serviceRequest.create({
      data: {
        customerId,
        vehicleId: vehicle!.id,
        category: data.category,
        title: data.title,
        description: data.description,
        address: '12th Main Road, Indiranagar, Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        urgency: data.urgency ?? 'NORMAL',
        status: data.status,
        isBroadcast: true,
        expiresAt: new Date(now + 7 * day),
        createdAt: new Date(now - data.createdHoursAgo * hour),
      },
    });
  }

  async function createJob(input: {
    title: string;
    category: 'REPAIR' | 'MAINTENANCE' | 'INSPECTION';
    description: string;
    requestStatus: 'QUOTES_RECEIVED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    bookingStatus: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    amount: number;
    createdAt: Date;
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    paymentStatus?: 'AUTHORIZED' | 'RELEASED';
    notes?: string;
  }) {
    const request = await createRequest({
      title: input.title,
      category: input.category,
      description: input.description,
      status: input.requestStatus,
      createdHoursAgo: Math.max(1, Math.round((now - input.createdAt.getTime()) / hour)),
    });

    const labour = Math.round(input.amount * 0.6);
    const parts = input.amount - labour;
    const quotation = await prisma.quotation.create({
      data: {
        requestId: request.id,
        providerId: provider!.id,
        partsCost: parts,
        labourCost: labour,
        totalCost: input.amount,
        warrantyDays: 30,
        etaDescription: 'Same day service',
        deliveryMethod: 'PICKUP',
        status: 'ACCEPTED',
        notes: 'Includes inspection and road test.',
      },
    });

    const booking = await prisma.booking.create({
      data: {
        quotationId: quotation.id,
        customerId,
        providerId: provider!.id,
        status: input.bookingStatus,
        scheduledAt: input.scheduledAt,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        completionNotes: input.notes,
        createdAt: input.createdAt,
      },
    });

    if (input.paymentStatus) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: input.amount,
          currency: 'INR',
          status: input.paymentStatus,
          method: 'UPI',
          gatewayPaymentId: `pay_mechanic_demo_${booking.id.slice(0, 8)}`,
          paidAt: input.createdAt,
          paidToProviderAt:
            input.paymentStatus === 'RELEASED' ? input.completedAt ?? null : null,
        updatedAt:
          input.paymentStatus === 'AUTHORIZED'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : undefined,
        },
      });
    }

    return booking;
  }

  const confirmed = await createJob({
    title: 'Brake pad replacement',
    category: 'REPAIR',
    description: 'Front brake pads worn, pedal feels soft. Creta 2022.',
    requestStatus: 'ACCEPTED',
    bookingStatus: 'CONFIRMED',
    amount: 4200,
    createdAt: new Date(now - 2 * day),
    scheduledAt: new Date(now + day),
    paymentStatus: 'AUTHORIZED',
  });

  const active = await createJob({
    title: 'Periodic service',
    category: 'MAINTENANCE',
    description: '20,000 km service — oil, filters and fluid check.',
    requestStatus: 'IN_PROGRESS',
    bookingStatus: 'IN_PROGRESS',
    amount: 2850,
    createdAt: new Date(now - 6 * hour),
    scheduledAt: new Date(now - 2 * hour),
    startedAt: new Date(now - hour),
    paymentStatus: 'AUTHORIZED',
  });

  const completed = await createJob({
    title: 'Suspension inspection',
    category: 'INSPECTION',
    description: 'Clunking over speed breakers, check bushings and struts.',
    requestStatus: 'COMPLETED',
    bookingStatus: 'COMPLETED',
    amount: 6500,
    createdAt: new Date(now - 4 * day),
    scheduledAt: new Date(now - 3 * day),
    startedAt: new Date(now - 3 * day),
    completedAt: new Date(now - 3 * day + 2 * hour),
    paymentStatus: 'RELEASED',
    notes: 'Replaced front stabiliser links and road tested.',
  });

  await prisma.review.create({
    data: {
      bookingId: completed.id,
      customerId,
      providerId: provider.id,
      rating: 5,
      comment: 'Quick diagnosis and the noise is gone.',
    },
  });

  await createJob({
    title: 'Clutch adjustment',
    category: 'REPAIR',
    description: 'Clutch bite point is high, adjustment requested.',
    requestStatus: 'CANCELLED',
    bookingStatus: 'CANCELLED',
    amount: 1800,
    createdAt: new Date(now - 6 * day),
    scheduledAt: new Date(now - 5 * day),
  });

  await createRequest({
    title: 'Clutch noise diagnosis',
    category: 'REPAIR',
    description: 'Squealing noise when pressing the clutch in the morning.',
    status: 'OPEN',
    createdHoursAgo: 2,
    urgency: 'URGENT',
  });

  const quotedRequest = await createRequest({
    title: 'AC cooling check',
    category: 'MAINTENANCE',
    description: 'Air conditioning is not cooling enough on the highway.',
    status: 'QUOTES_RECEIVED',
    createdHoursAgo: 5,
  });
  await prisma.quotation.create({
    data: {
      requestId: quotedRequest.id,
      providerId: provider.id,
      partsCost: 2600,
      labourCost: 900,
      totalCost: 3500,
      warrantyDays: 30,
      etaDescription: 'Can inspect tomorrow morning',
      deliveryMethod: 'PICKUP',
      status: 'PENDING',
    },
  });

  // Keep provider stats aligned with the demo jobs.
  await prisma.providerProfile.update({
    where: { id: provider.id },
    data: {
      completedJobs: 25,
      avgRating: 4.7,
      totalReviews: 19,
    },
  });

  console.log('Mechanic demo data ready');
  console.log('  email:    workshop@weyro.dev');
  console.log('  password: WeyroDev@2026');
  console.log('  jobs:     confirmed, in progress, completed, cancelled');
  console.log('  requests: 1 open, 1 quoted');
  console.log('  next job: ', confirmed.scheduledAt?.toISOString());
  console.log('  active:   ', active.id);
}

main()
  .catch((error) => {
    console.error(error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
