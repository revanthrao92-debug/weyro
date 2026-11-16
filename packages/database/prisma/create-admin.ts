/**
 * Create the first ADMIN account from environment variables.
 *
 *   ADMIN_EMAIL=ops@weyro.in ADMIN_PHONE=9876543210 ADMIN_PASSWORD='<12+ chars>' \
 *   CONFIRM_CREATE_ADMIN=yes npm run db:create-admin
 *
 * Safety rails:
 *  - nothing happens unless CONFIRM_CREATE_ADMIN=yes (so it can never run by accident);
 *  - it REFUSES if any ADMIN already exists — this is a bootstrap tool, not a way
 *    to add admins later;
 *  - the phone is normalized to E.164 and must be valid; the password must be
 *    at least 12 characters with a letter and a number;
 *  - the password is read from the environment only and never printed.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const prisma = new PrismaClient();

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

async function main() {
  if (process.env.CONFIRM_CREATE_ADMIN !== 'yes') {
    fail('Refusing to run: set CONFIRM_CREATE_ADMIN=yes to confirm you want to create an admin.');
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const rawPhone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !rawPhone || !password) {
    fail('ADMIN_EMAIL, ADMIN_PHONE and ADMIN_PASSWORD are all required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('ADMIN_EMAIL is not a valid email address.');

  const parsed = parsePhoneNumberFromString(rawPhone, 'IN');
  if (!parsed || !parsed.isValid()) fail('ADMIN_PHONE is not a valid phone number.');
  const phone = parsed.number; // E.164

  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail('ADMIN_PASSWORD must be at least 12 characters and contain a letter and a number.');
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  if (existingAdmin) {
    fail('An ADMIN account already exists. Refusing to create another.');
  }

  const clash = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { email: true, phone: true },
  });
  if (clash) {
    fail('A user with that email or phone already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      email,
      phone,
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
      phoneVerified: true, // password login requires a verified phone
    },
    select: { id: true, email: true, phone: true },
  });

  console.log(`✔ Admin created: ${admin.email} (${admin.phone}) id=${admin.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
