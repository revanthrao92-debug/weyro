#!/usr/bin/env bash

if [ "${NODE_ENV:-}" = "production" ] || [ "${ALLOW_DEMO_SEED:-}" != "true" ]; then
  echo "Refusing to reset/seed a non-development database. Set ALLOW_DEMO_SEED=true explicitly." >&2
  exit 1
fi

# Reset the local PostGIS database: drop, migrate, seed.
# Usage: ./scripts/db-reset.sh
set -euo pipefail

echo "🗑  Dropping and recreating weyro_db..."
npx prisma migrate reset --schema packages/database/prisma/schema.prisma --force --skip-seed

echo "🌱 Seeding database..."
npx prisma db seed --schema packages/database/prisma/schema.prisma

echo "✅ Database reset complete."
