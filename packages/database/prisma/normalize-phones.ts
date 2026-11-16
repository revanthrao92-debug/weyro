/**
 * H3 data migration: normalize existing phone numbers to E.164 (+919876543210).
 *
 * Usage (from packages/database, DATABASE_URL set):
 *   npm run db:normalize-phones            # dry run — prints what would change
 *   npm run db:normalize-phones -- --apply # write the changes
 *
 * Safe to re-run. Rows that cannot be parsed, or whose normalized value would
 * collide with a different existing user, are logged and SKIPPED — never fail
 * the whole run and never merge accounts automatically.
 */
import { PrismaClient } from '@prisma/client';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

function toE164(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw.trim(), 'IN');
  return parsed && parsed.isValid() ? parsed.number : null;
}

async function main() {
  const stats = { users: 0, providers: 0, unchanged: 0, invalid: 0, conflicts: 0 };

  const users = await prisma.user.findMany({ select: { id: true, phone: true } });
  const taken = new Map(users.map((u) => [u.phone, u.id]));

  for (const user of users) {
    const normalized = toE164(user.phone);
    if (!normalized) {
      console.warn(`[skip:invalid] user ${user.id} phone "${user.phone}" is not a valid number`);
      stats.invalid++;
      continue;
    }
    if (normalized === user.phone) {
      stats.unchanged++;
      continue;
    }
    const owner = taken.get(normalized);
    if (owner && owner !== user.id) {
      console.warn(
        `[skip:conflict] user ${user.id} "${user.phone}" → ${normalized} already belongs to user ${owner}`,
      );
      stats.conflicts++;
      continue;
    }
    console.log(`[user] ${user.id}: "${user.phone}" → ${normalized}`);
    if (apply) {
      await prisma.user.update({ where: { id: user.id }, data: { phone: normalized } });
    }
    taken.delete(user.phone);
    taken.set(normalized, user.id);
    stats.users++;
  }

  // provider_profiles.phone is not unique, so there is nothing to collide with.
  const profiles = await prisma.providerProfile.findMany({ select: { id: true, phone: true } });
  for (const profile of profiles) {
    const normalized = toE164(profile.phone);
    if (!normalized) {
      console.warn(`[skip:invalid] provider ${profile.id} phone "${profile.phone}" is not valid`);
      stats.invalid++;
      continue;
    }
    if (normalized === profile.phone) continue;
    console.log(`[provider] ${profile.id}: "${profile.phone}" → ${normalized}`);
    if (apply) {
      await prisma.providerProfile.update({ where: { id: profile.id }, data: { phone: normalized } });
    }
    stats.providers++;
  }

  // Pending OTP rows are keyed by the old spelling and are short-lived: drop them.
  if (apply) {
    const removed = await prisma.oTP.deleteMany({});
    console.log(`Cleared ${removed.count} pending OTP row(s).`);
  }

  console.log(
    `${apply ? 'APPLIED' : 'DRY RUN'}: users=${stats.users} providers=${stats.providers} ` +
      `unchanged=${stats.unchanged} invalid=${stats.invalid} conflicts=${stats.conflicts}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
