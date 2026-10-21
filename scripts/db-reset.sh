#!/usr/bin/env bash
# Reset the local PostGIS database: drop, migrate, seed.
# Usage: ./scripts/db-reset.sh
set -euo pipefail

echo "🗑  Dropping and recreating weyro_db..."
npx prisma migrate reset --schema packages/database/prisma/schema.prisma --force --skip-seed

echo "🌱 Seeding database..."
npx prisma db seed --schema packages/database/prisma/schema.prisma

echo "✅ Database reset complete."
