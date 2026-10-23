import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Seeding is disabled in production environments.');
    return;
  }

  console.log('🌱 Starting Weyro database seeding for Indian market (INR / UPI / +91)...');

  const defaultPassword = process.env.DEV_SEED_PASSWORD || 'WeyroDev@2026';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  // 1. Create or Update Administrator
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@weyro.in';
  const adminPhone = process.env.ADMIN_PHONE || '+919876500001';
  const adminPassword = process.env.ADMIN_PASSWORD || defaultPassword;
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email: adminEmail,
      phone: adminPhone,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
    },
  });
  console.log(`👤 Admin user ready: ${adminUser.email} (Role: ${adminUser.role})`);

  // 2. Create Verified Customer (Rohan Sharma - Bengaluru)
  const customerEmail = 'rohan.sharma@example.in';
  const customerUser = await prisma.user.upsert({
    where: { email: customerEmail },
    update: { passwordHash },
    create: {
      email: customerEmail,
      phone: '+919845012345',
      passwordHash,
      role: 'CUSTOMER',
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      customerProfile: {
        create: {
          firstName: 'Rohan',
          lastName: 'Sharma',
          savedAddresses: [
            {
              title: 'Home',
              address: '100ft Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038',
              latitude: 12.9784,
              longitude: 77.6408,
            },
          ],
        },
      },
    },
    include: { customerProfile: true },
  });

  const customerProfileId = customerUser.customerProfile!.id;

  // 3. Create Customer Vehicle (Hyundai Creta)
  const vehicle = await prisma.vehicle.upsert({
    where: { registrationNumber: 'KA-01-MJ-4021' },
    update: { customerId: customerProfileId },
    create: {
      customerId: customerProfileId,
      make: 'Hyundai',
      model: 'Creta 1.5 SX',
      year: 2023,
      registrationNumber: 'KA-01-MJ-4021',
      fuelType: 'PETROL',
      color: 'Polar White',
    },
  });

  // 4. Create Verified Providers in Bengaluru
  const provider1User = await prisma.user.upsert({
    where: { email: 'contact@apexautobangalore.in' },
    update: { passwordHash },
    create: {
      email: 'contact@apexautobangalore.in',
      phone: '+919880011223',
      passwordHash,
      role: 'PROVIDER',
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      providerProfile: {
        create: {
          businessName: 'Apex OEM Auto Spares & Body Works',
          providerType: 'PARTS_DEALER',
          description: 'Specialists in certified OEM body panels, LED headlamps, and genuine spare parts across Bengaluru.',
          phone: '+919880011223',
          address: 'Plot 18, Whitefield Industrial Area, Bengaluru, Karnataka 560066',
          latitude: 12.9698,
          longitude: 77.7500,
          serviceRadiusKm: 30,
          verificationStatus: 'VERIFIED',
          avgRating: 4.9,
          totalReviews: 84,
          completedJobs: 142,
          isAvailable: true,
        },
      },
    },
    include: { providerProfile: true },
  });

  const provider2User = await prisma.user.upsert({
    where: { email: 'support@koramangalamotors.in' },
    update: { passwordHash },
    create: {
      email: 'support@koramangalamotors.in',
      phone: '+919820033445',
      passwordHash,
      role: 'PROVIDER',
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      providerProfile: {
        create: {
          businessName: 'Koramangala Motor Works & Diagnostics',
          providerType: 'GARAGE',
          description: 'Full-service multi-brand diagnostic workshop with computerized paint booth and suspension repairs.',
          phone: '+919820033445',
          address: '5th Block, Koramangala, Bengaluru, Karnataka 560095',
          latitude: 12.9352,
          longitude: 77.6245,
          serviceRadiusKm: 25,
          verificationStatus: 'VERIFIED',
          avgRating: 4.8,
          totalReviews: 56,
          completedJobs: 98,
          isAvailable: true,
        },
      },
    },
    include: { providerProfile: true },
  });

  const provider3User = await prisma.user.upsert({
    where: { email: 'dispatch@bengalurutow24.in' },
    update: { passwordHash },
    create: {
      email: 'dispatch@bengalurutow24.in',
      phone: '+919845067788',
      passwordHash,
      role: 'PROVIDER',
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      providerProfile: {
        create: {
          businessName: 'Bengaluru Tow 24x7',
          providerType: 'TOWING',
          description: '24x7 flatbed and hook-and-chain towing across Bengaluru with live driver tracking.',
          phone: '+919845067788',
          address: 'Hosur Road, Bommanahalli, Bengaluru, Karnataka 560068',
          latitude: 12.9010,
          longitude: 77.6220,
          serviceRadiusKm: 40,
          verificationStatus: 'VERIFIED',
          avgRating: 4.7,
          totalReviews: 39,
          completedJobs: 210,
          isAvailable: true,
          towingVehicleTypes: ['FLATBED', 'HOOK_AND_CHAIN'],
          maxVehicleWeightKg: 3500,
          towingBaseFee: 500,
          towingPerKmFee: 40,
        },
      },
    },
    include: { providerProfile: true },
  });

  // 5. Create Active Service Request
  let request = await prisma.serviceRequest.findFirst({
    where: { customerId: customerProfileId, title: 'Front Bumper & Headlight Assembly Replacement' },
  });

  if (!request) {
    request = await prisma.serviceRequest.create({
      data: {
        customerId: customerProfileId,
        vehicleId: vehicle.id,
        category: 'REPAIR',
        title: 'Front Bumper & Headlight Assembly Replacement',
        description: 'Cracked front bumper valence and broken right-side LED projector headlamp unit after parking pole scrape.',
        address: 'Indiranagar, Bengaluru, Karnataka',
        latitude: 12.9784,
        longitude: 77.6408,
        urgency: 'URGENT',
        status: 'OPEN',
        isBroadcast: true,
        media: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
              fileType: 'image/jpeg',
            },
          ],
        },
        fulfillmentType: 'ON_SITE',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 5b. Create an open towing request for the towing feed
  let towingRequest = await prisma.serviceRequest.findFirst({
    where: {
      customerId: customerProfileId,
      title: 'Vehicle Towing Required - Flatbed',
    },
  });

  if (!towingRequest) {
    towingRequest = await prisma.serviceRequest.create({
      data: {
        customerId: customerProfileId,
        vehicleId: vehicle.id,
        category: 'TOWING',
        title: 'Vehicle Towing Required - Flatbed',
        description:
          'Sedan will not start after overheating. Needs a flatbed tow to the workshop in Koramangala.',
        address: 'Indiranagar, Bengaluru, Karnataka',
        latitude: 12.9784,
        longitude: 77.6408,
        urgency: 'EMERGENCY',
        status: 'OPEN',
        isBroadcast: true,
        fulfillmentType: 'TOW_TO_GARAGE',
        dropoffAddress: '5th Block, Koramangala, Bengaluru, Karnataka 560095',
        dropoffLatitude: 12.9352,
        dropoffLongitude: 77.6245,
        towingVehicleType: 'FLATBED',
        vehicleWeightKg: 1450,
        towingDistanceKm: 5.12,
        towingEstimatedFare: 705,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.$executeRaw`
      UPDATE "service_requests"
      SET "dropoffLocation" = ST_SetSRID(
        ST_MakePoint(${77.6245}, ${12.9352}),
        4326
      )::geography
      WHERE "id" = ${towingRequest.id}
    `;
  }

  // 6. Create Verified Quotation and Booking
  let quotation = await prisma.quotation.findFirst({
    where: { requestId: request.id, providerId: provider1User.providerProfile!.id },
  });

  if (!quotation) {
    quotation = await prisma.quotation.create({
      data: {
        requestId: request.id,
        providerId: provider1User.providerProfile!.id,
        partsCost: 8500,
        labourCost: 1500,
        shippingCost: 500,
        totalCost: 10500,
        partCondition: 'OEM',
        warrantyDays: 90,
        etaDescription: '2 business days',
        deliveryMethod: 'DOORSTEP_DELIVERY',
        notes: 'Genuine Hyundai OEM front bumper and projector assembly. Includes fitment and insured local delivery.',
        status: 'ACCEPTED',
      },
    });

    await prisma.serviceRequest.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED' },
    });

    const booking = await prisma.booking.create({
      data: {
        quotationId: quotation.id,
        customerId: customerProfileId,
        providerId: provider1User.providerProfile!.id,
        status: 'CONFIRMED',
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        completionNotes: 'Scheduled for doorstep delivery and fitment.',
        payments: {
          create: {
            amount: 10500,
            currency: 'INR',
            status: 'PENDING',
            method: 'UPI',
            gatewayPaymentId: 'pay_demo_seed_01',
            gatewayOrderId: 'order_demo_seed_01',
          },
        },
      },
    });
    console.log(`📋 Created confirmed booking in INR: ${booking.id}`);
  }

  // 7. Shop catalogue: demo parts from both dealers plus two service packages
  type SparePartSeed = {
    name: string;
    partNumber: string;
    compatibleMakes: string[];
    compatibleModels: string[];
    condition: 'OEM' | 'AFTERMARKET' | 'USED';
    price: number;
    stockQuantity: number;
    kind?: 'PART' | 'PACKAGE';
    description: string;
    estimatedMinutes?: number;
    imageUrl?: string;
  };

  const upsertSparePart = async (providerId: string, data: SparePartSeed) => {
    const existing = await prisma.sparePart.findFirst({
      where: { providerId, partNumber: data.partNumber },
    });

    if (existing) {
      return prisma.sparePart.update({ where: { id: existing.id }, data });
    }

    return prisma.sparePart.create({ data: { providerId, ...data } });
  };

  const dealerParts: SparePartSeed[] = [
    {
      name: 'Front Bumper Assembly',
      partNumber: 'APX-HY-CRT-FB01',
      compatibleMakes: ['Hyundai'],
      compatibleModels: ['Creta 2020-2024'],
      condition: 'OEM',
      price: 8499,
      stockQuantity: 4,
      description:
        'Genuine Hyundai front bumper with sensor cut-outs and primer finish. Fitment included at partner workshops.',
      imageUrl:
        'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80',
    },
    {
      name: 'LED Projector Headlamp (Right)',
      partNumber: 'APX-HY-CRT-HL02',
      compatibleMakes: ['Hyundai'],
      compatibleModels: ['Creta 2020-2024'],
      condition: 'OEM',
      price: 12999,
      stockQuantity: 2,
      description:
        'Right-side LED projector headlamp unit with DRL. Comes with a 1-year manufacturer warranty.',
      imageUrl:
        'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80',
    },
    {
      name: 'Front Brake Pad Set',
      partNumber: 'APX-MR-SWT-BP03',
      compatibleMakes: ['Maruti Suzuki'],
      compatibleModels: ['Swift', 'Dzire'],
      condition: 'AFTERMARKET',
      price: 1899,
      stockQuantity: 12,
      description:
        'Low-dust ceramic brake pads for swift city driving. Sold as a front-axle set.',
    },
    {
      name: 'Engine Air Filter',
      partNumber: 'APX-HN-CTY-AF04',
      compatibleMakes: ['Honda'],
      compatibleModels: ['City'],
      condition: 'AFTERMARKET',
      price: 749,
      stockQuantity: 20,
      description:
        'High-flow engine air filter with OEM-equivalent fitment. Recommended replacement every 15,000 km.',
    },
  ];

  const garageParts: SparePartSeed[] = [
    {
      name: 'Fully Synthetic Engine Oil 5W-30 (4L)',
      partNumber: 'KMW-OIL-5W30-4L',
      compatibleMakes: ['Hyundai', 'Maruti Suzuki', 'Honda'],
      compatibleModels: ['Universal'],
      condition: 'AFTERMARKET',
      price: 2899,
      stockQuantity: 10,
      description:
        'API SP certified fully synthetic engine oil. Suitable for petrol and diesel passenger cars.',
    },
    {
      name: 'Suspension Lower Arm',
      partNumber: 'KMW-HY-I20-LA01',
      compatibleMakes: ['Hyundai'],
      compatibleModels: ['i20'],
      condition: 'OEM',
      price: 4299,
      stockQuantity: 3,
      description:
        'OEM front lower control arm with pressed bushings. Recommended to replace in pairs.',
    },
    {
      name: 'Clutch Plate Kit',
      partNumber: 'KMW-MR-BAL-CP01',
      compatibleMakes: ['Maruti Suzuki'],
      compatibleModels: ['Baleno'],
      condition: 'OEM',
      price: 5499,
      stockQuantity: 2,
      description:
        'Clutch disc, pressure plate and release bearing kit for 1.2L petrol Baleno.',
    },
    {
      name: 'Wiper Blade Set (24"/16")',
      partNumber: 'KMW-UNI-WB-01',
      compatibleMakes: ['Hyundai', 'Maruti Suzuki', 'Honda'],
      compatibleModels: ['Universal'],
      condition: 'AFTERMARKET',
      price: 899,
      stockQuantity: 15,
      description:
        'Beam-style all-weather wiper blades with adapters for common hook arms.',
    },
  ];

  const garagePackages: SparePartSeed[] = [
    {
      name: 'Monsoon Care Package',
      partNumber: 'KMW-PKG-MONSOON',
      compatibleMakes: ['Universal'],
      compatibleModels: ['Universal'],
      condition: 'AFTERMARKET',
      price: 3499,
      stockQuantity: 1,
      kind: 'PACKAGE',
      estimatedMinutes: 60,
      description:
        'Underbody anti-rust spray, brake inspection, wiper check and cabin sanitisation at our Koramangala workshop.',
    },
    {
      name: 'Pre-Delivery Inspection Package',
      partNumber: 'KMW-PKG-PDI',
      compatibleMakes: ['Universal'],
      compatibleModels: ['Universal'],
      condition: 'AFTERMARKET',
      price: 1999,
      stockQuantity: 1,
      kind: 'PACKAGE',
      estimatedMinutes: 45,
      description:
        '45-minute, 30-point inspection with fluid top-up and a written condition report for used-car purchases.',
    },
  ];

  const dealerPartRows = await Promise.all(
    dealerParts.map((part) =>
      upsertSparePart(provider1User.providerProfile!.id, part),
    ),
  );
  const garagePartRows = await Promise.all(
    garageParts.map((part) =>
      upsertSparePart(provider2User.providerProfile!.id, part),
    ),
  );

  await Promise.all(
    garagePackages.map((pkg) =>
      upsertSparePart(provider2User.providerProfile!.id, pkg),
    ),
  );

  console.log(
    `🛒 Shop catalogue ready: ${dealerPartRows.length + garagePartRows.length} parts, ${garagePackages.length} packages`,
  );

  // 8. One completed shop order so history/dashboard/payout flows have data
  const completedPart = dealerPartRows[0];
  const existingCompletedOrder = await prisma.sparePartOrder.findFirst({
    where: {
      customerId: customerProfileId,
      sparePartId: completedPart.id,
      status: 'PAID',
    },
  });

  if (!existingCompletedOrder) {
    await prisma.sparePartOrder.create({
      data: {
        sparePartId: completedPart.id,
        providerId: completedPart.providerId,
        customerId: customerProfileId,
        quantity: 1,
        unitPrice: completedPart.price,
        totalAmount: completedPart.price,
        currency: 'INR',
        status: 'PAID',
        gatewayOrderId: 'order_demo_spare_01',
        gatewayPaymentId: 'pay_demo_spare_01',
        paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.sparePart.update({
      where: { id: completedPart.id },
      data: { stockQuantity: { decrement: 1 } },
    });
  }

  console.log(`🧾 Completed shop order ready: ${completedPart.name}`);

  console.log(
    `🚛 Towing provider ready: ${provider3User.providerProfile?.businessName} (${towingRequest.towingDistanceKm} km demo request)`,
  );
  console.log(`✅ Seeding complete. All mock US/USD data replaced with India (INR/UPI/+91).`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
