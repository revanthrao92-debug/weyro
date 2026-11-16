import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma configuration. Replaces the deprecated `package.json#prisma` block
 * (removed in Prisma 7). A config file turns off Prisma's automatic .env
 * loading, so it is done explicitly here to keep local behaviour the same.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
