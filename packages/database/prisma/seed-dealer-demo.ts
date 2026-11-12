/**
 * Self-contained dealer demo data for the dealer interface phase.
 * Run from packages/database with apps/api/.env loaded:
 *   npx ts-node prisma/seed-dealer-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PARTS = [
  {
    name: 'Front Brake Pad Set',
    partNumber: 'APX-HY-CRT-BP01',
    condition: 'OEM' as const,
    price: 2499,
    stockQuantity: 12,
    description: 'Genuine front brake pads for Hyundai Creta 2020–2024.',
  },
  {
    name: 'Air Filter',
    partNumber: 'APX-HY-CRT-AF02',
    condition: 'AFTERMARKET' as const,
    price: 649,
    stockQuantity: 3,
    description: 'High-flow engine air filter.',
  },
  {
    name: 'LED Projector Headlamp (Right)',
    partNumber: 'APX-HY-CRT-HL03',
    condition: 'OEM' as const,
    price: 12999,
    stockQuantity: 2,
    description: 'OEM right headlamp assembly.',
  },
  {
    name: 'Wiper Blade Pair',
    partNumber: 'APX-HY-CRT-WB04',
    condition: 'AFTERMARKET' as const,
    price: 899,
    stockQuantity: 0,
    description: 'All-weather wiper blades, pair.',
  },
];

async function main() {
  const passwordHash = await bcrypt.hash('WeyroDev@2026', 12);

  let dealerUser = await prisma.user.findUnique({
    where: { email: 'contact@apexautobangalore.in' },
  });
  if (!dealerUser) {
    dealerUser = await prisma.user.create({
      data: {
        email: 'contact@apexautobangalore.in',
        phone: '+919880011223',
        passwordHash,
        role: 'PROVIDER',
        emailVerified: true,
        phoneVerified: true,
        providerProfile: {
          create: {
            businessName: 'Apex OEM Auto Spares',
            providerType: 'PARTS_DEALER',
            description:
              'Certified OEM body panels, lighting and genuine spare parts.',
            phone: '+919880011223',
            address: 'Plot 18, HITEC City, Hyderabad',
            latitude: 17.4483,
            longitude: 78.3915,
            serviceRadiusKm: 30,
            verificationStatus: 'VERIFIED',
            avgRating: 4.8,
            totalReviews: 36,
            completedJobs: 128,
            isAvailable: true,
          },
        },
      },
    });
  } else {
    await prisma.user.update({
      where: { id: dealerUser.id },
      data: { passwordHash, role: 'PROVIDER', isActive: true },
    });
  }

  let provider = await prisma.providerProfile.findUnique({
    where: { userId: dealerUser.id },
  });
  if (!provider) {
    provider = await prisma.providerProfile.create({
      data: {
        userId: dealerUser.id,
        businessName: 'Apex OEM Auto Spares',
        providerType: 'PARTS_DEALER',
        description:
          'Certified OEM body panels, lighting and genuine spare parts.',
        phone: '+919880011223',
        address: 'Plot 18, HITEC City, Hyderabad',
        latitude: 17.4483,
        longitude: 78.3915,
        serviceRadiusKm: 30,
        verificationStatus: 'VERIFIED',
        avgRating: 4.8,
        totalReviews: 36,
        completedJobs: 128,
        isAvailable: true,
      },
    });
  }

  for (const part of DEMO_PARTS) {
    const existing = await prisma.sparePart.findFirst({
      where: { providerId: provider.id, partNumber: part.partNumber },
    });
    if (!existing) {
      await prisma.sparePart.create({
        data: {
          ...part,
          providerId: provider.id,
          compatibleMakes: ['Hyundai'],
          compatibleModels: ['Creta 2020-2024'],
          kind: 'PART',
        },
      });
    }
  }

  const parts = await prisma.sparePart.findMany({
    where: { providerId: provider.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const customer = await prisma.user.findFirst({
    where: { email: 'prodtest3@weyro.dev' },
    include: { customerProfile: true },
  });
  if (!customer?.customerProfile) {
    throw new Error('Customer prodtest3@weyro.dev not found.');
  }
  const customerId = customer.customerProfile.id;

  await prisma.sparePartOrder.deleteMany({
    where: { gatewayOrderId: { startsWith: 'apex_demo_' } },
  });

  const shipping = {
    shippingName: 'Prod Test',
    shippingPhone: '+919876500003',
    shippingAddress: '12th Main Road, Indiranagar',
    shippingCity: 'Bengaluru',
    shippingPincode: '560038',
  };

  const createOrder = (
    index: number,
    suffix: string,
    data: Record<string, unknown>,
  ) => {
    const part = parts[index % parts.length];
    return prisma.sparePartOrder.create({
      data: {
        sparePartId: part.id,
        providerId: provider.id,
        customerId,
        quantity: 1,
        unitPrice: part.price,
        totalAmount: part.price,
        currency: 'INR',
        status: 'PAID',
        fulfillmentStatus: 'PENDING',
        gatewayOrderId: `apex_demo_${suffix}`,
        gatewayPaymentId: `pay_apex_demo_${suffix}`,
        paidAt: new Date(Date.now() - index * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - index * 60 * 60 * 1000),
        ...shipping,
        ...data,
      },
    });
  };

  await createOrder(0, 'pending', {});
  await createOrder(1, 'processing', {
    fulfillmentStatus: 'PROCESSING',
    dealerNotes: 'Packed and waiting for courier pickup.',
  });
  await createOrder(2, 'shipped', {
    fulfillmentStatus: 'SHIPPED',
    carrierName: 'Delhivery',
    trackingNumber: 'DLV-DEMO-88421',
    shippedAt: new Date(Date.now() - 30 * 60 * 1000),
  });

  await prisma.sparePartOrder.create({
    data: {
      sparePartId: parts[0].id,
      providerId: provider.id,
      customerId,
      quantity: 1,
      unitPrice: parts[0].price,
      totalAmount: parts[0].price,
      currency: 'INR',
      status: 'PENDING',
      gatewayOrderId: 'apex_demo_unpaid',
      ...shipping,
    },
  });

  // 30 days of sales history so the financial graph and forecast have data.
  const history: Array<{ days: number; amount: number; refunded?: boolean }> = [];
  for (let index = 0; index < 24; index += 1) {
    const days = 1 + Math.floor((index * 29) / 24);
    const amount = 1200 + ((index * 370) % 9000);
    history.push({ days, amount, refunded: index === 7 });
  }

  for (const [index, item] of history.entries()) {
    const part = parts[index % parts.length];
    const paidAt = new Date(Date.now() - item.days * 24 * 60 * 60 * 1000);
    await prisma.sparePartOrder.create({
      data: {
        sparePartId: part.id,
        providerId: provider.id,
        customerId,
        quantity: 1,
        unitPrice: item.amount,
        totalAmount: item.amount,
        currency: 'INR',
        status: item.refunded ? 'REFUNDED' : 'PAID',
        fulfillmentStatus: item.refunded ? 'CANCELLED' : 'DELIVERED',
        gatewayOrderId: `apex_demo_history_${index}`,
        gatewayPaymentId: `pay_apex_history_${index}`,
        paidAt,
        createdAt: paidAt,
        deliveredAt: item.refunded ? null : new Date(paidAt.getTime() + 2 * 24 * 60 * 60 * 1000),
        refundedAt: item.refunded ? new Date(paidAt.getTime() + 24 * 60 * 60 * 1000) : null,
        ...shipping,
      },
    });
  }

  console.log('Dealer demo data ready');
  console.log('  email:    contact@apexautobangalore.in');
  console.log('  password: WeyroDev@2026');
  console.log('  listings:', parts.length);
  console.log('  orders:   3 live paid + 1 unpaid + 24 historical (1 refunded)');
}

main()
  .catch((error) => {
    console.error(error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
