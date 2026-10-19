import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Weyro database seeding...');

  // 1. Create Customer
  const customerUser = await prisma.user.upsert({
    where: { email: 'marcus.vance@example.com' },
    update: {},
    create: {
      email: 'marcus.vance@example.com',
      phone: '+1 (555) 234-5678',
      passwordHash: 'hashed_secure_secret',
      role: 'CUSTOMER',
      emailVerified: true,
      phoneVerified: true,
      customerProfile: {
        create: {
          firstName: 'Marcus',
          lastName: 'Vance',
          savedAddresses: [
            {
              title: 'Home',
              address: '742 Evergreen Terrace, Springfield',
              latitude: 40.7128,
              longitude: -74.006,
            },
          ],
        },
      },
    },
    include: { customerProfile: true },
  });

  const customerProfileId = customerUser.customerProfile!.id;

  // 2. Create Vehicle
  const vehicle = await prisma.vehicle.create({
    data: {
      customerId: customerProfileId,
      make: 'BMW',
      model: '330i M-Sport',
      year: 2022,
      registrationNumber: 'WEY-8921-US',
      fuelType: 'PETROL',
      color: 'Mineral Grey',
    },
  });

  // 3. Create Verified Providers
  const provider1User = await prisma.user.upsert({
    where: { email: 'contact@apexoemparts.com' },
    update: {},
    create: {
      email: 'contact@apexoemparts.com',
      phone: '+1 (555) 876-5432',
      passwordHash: 'hashed_secure_secret',
      role: 'PROVIDER',
      providerProfile: {
        create: {
          businessName: 'Apex OEM Auto Dismantlers',
          providerType: 'PARTS_DEALER',
          description: 'Specialists in certified German OEM body parts and matrix LED lighting.',
          phone: '+1 (555) 876-5432',
          address: 'Industrial Parkway Sector 4, Springfield',
          latitude: 40.7589,
          longitude: -73.9851,
          serviceRadiusKm: 500,
          verificationStatus: 'VERIFIED',
          avgRating: 4.9,
          totalReviews: 84,
          completedJobs: 142,
        },
      },
    },
    include: { providerProfile: true },
  });

  const provider2User = await prisma.user.upsert({
    where: { email: 'service@precisioneuro.com' },
    update: {},
    create: {
      email: 'service@precisioneuro.com',
      phone: '+1 (555) 345-6789',
      passwordHash: 'hashed_secure_secret',
      role: 'PROVIDER',
      providerProfile: {
        create: {
          businessName: 'Precision Euro-Tech Motors',
          providerType: 'GARAGE',
          description: 'Full-service workshop with dedicated paint spray booth and sensor calibration.',
          phone: '+1 (555) 345-6789',
          address: '404 Oakridge Ave, Springfield',
          latitude: 40.7282,
          longitude: -73.7949,
          serviceRadiusKm: 25,
          verificationStatus: 'VERIFIED',
          avgRating: 4.8,
          totalReviews: 56,
          completedJobs: 98,
        },
      },
    },
    include: { providerProfile: true },
  });

  // 4. Create Service Request
  const request = await prisma.serviceRequest.create({
    data: {
      customerId: customerProfileId,
      vehicleId: vehicle.id,
      category: 'REPAIR',
      title: 'Front Bumper & Headlight Assembly',
      description: 'Cracked lower valence and damaged LED matrix headlight unit from parking post impact.',
      address: '742 Evergreen Terrace, Springfield',
      latitude: 40.7128,
      longitude: -74.006,
      urgency: 'URGENT',
      status: 'OPEN',
      isBroadcast: true,
      damagePhotos: [
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
      ],
      fulfillmentType: 'PARTS_SHIPPING',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // 5. Create Quotation & Escrow Booking
  const quotation = await prisma.quotation.create({
    data: {
      requestId: request.id,
      providerId: provider1User.providerProfile!.id,
      partsCost: 1450,
      labourCost: 0,
      shippingCost: 0,
      totalCost: 1450,
      partCondition: 'OEM',
      warrantyDays: 90,
      etaDescription: '2 business days',
      deliveryMethod: 'PARTS_COURIER',
      notes: 'Genuine OEM LED matrix unit in pristine condition. Includes insured courier shipping.',
      status: 'ACCEPTED',
    },
  });

  const booking = await prisma.booking.create({
    data: {
      quotationId: quotation.id,
      customerId: customerProfileId,
      providerId: provider1User.providerProfile!.id,
      status: 'CONFIRMED',
      payments: {
        create: {
          amount: 1450,
          currency: 'USD',
          status: 'AUTHORIZED',
          method: 'CARD',
          gatewayPaymentId: 'escrow_seed_01',
        },
      },
    },
  });

  console.log(`✅ Seeding complete: Customer (${customerUser.id}), Vehicle (${vehicle.id}), Request (${request.id}), Booking (${booking.id})`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
