/**
 * Admin verification demo data.
 * Run from packages/database with apps/api/.env loaded:
 *   npx ts-node prisma/seed-admin-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DOCS = {
  'GST certificate':
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  'PAN card':
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  'Shop licence':
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
};

async function ensureProvider(input: {
  email: string;
  phone: string;
  businessName: string;
  providerType: 'GARAGE' | 'PARTS_DEALER' | 'TOWING';
  status: 'PENDING' | 'REJECTED';
  address: string;
}) {
  const passwordHash = await bcrypt.hash('WeyroDev@2026', 12);
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

  const existing = await prisma.providerProfile.findUnique({
    where: { userId: user.id },
  });
  if (existing) {
    return prisma.providerProfile.update({
      where: { id: existing.id },
      data: {
        businessName: input.businessName,
        providerType: input.providerType,
        verificationStatus: input.status,
        verificationDocuments: DOCS,
        address: input.address,
        completedJobs: 0,
        avgRating: 0,
        totalReviews: 0,
      },
    });
  }
  return prisma.providerProfile.create({
    data: {
      userId: user.id,
      businessName: input.businessName,
      providerType: input.providerType,
      description: 'Multi-brand workshop and service centre.',
      phone: input.phone,
      address: input.address,
      latitude: 17.4239,
      longitude: 78.4484,
      serviceRadiusKm: 20,
      verificationStatus: input.status,
      verificationDocuments: DOCS,
      completedJobs: 0,
      avgRating: 0,
      totalReviews: 0,
      isAvailable: true,
    },
  });
}

async function main() {
  const pending = await ensureProvider({
    email: 'pending@weyro.dev',
    phone: '+919880055667',
    businessName: 'Metro Auto Garage',
    providerType: 'GARAGE',
    status: 'PENDING',
    address: 'Plot 7, Madhapur, Hyderabad',
  });
  const rejected = await ensureProvider({
    email: 'rejected@weyro.dev',
    phone: '+919880055778',
    businessName: 'City Wheels Service',
    providerType: 'GARAGE',
    status: 'REJECTED',
    address: 'Road 3, Banjara Hills, Hyderabad',
  });

  console.log('Admin demo providers ready');
  console.log('  pending: ', pending.businessName, pending.id);
  console.log('  rejected:', rejected.businessName, rejected.id);
  console.log('  documents: 3 files each');
}

main()
  .catch((error) => {
    console.error(error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
