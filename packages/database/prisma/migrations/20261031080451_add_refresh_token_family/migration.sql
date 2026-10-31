-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'RELEASED';

-- DropIndex
DROP INDEX "customer_profiles_deletedAt_idx";

-- DropIndex
DROP INDEX "provider_profiles_deletedAt_idx";

-- DropIndex
DROP INDEX "provider_profiles_location_idx";

-- DropIndex
DROP INDEX "service_requests_location_idx";

-- DropIndex
DROP INDEX "service_requests_roadsideKind_idx";

-- DropIndex
DROP INDEX "spare_parts_kind_idx";

-- DropIndex
DROP INDEX "users_deletedAt_idx";

-- DropIndex
DROP INDEX "vehicles_deletedAt_idx";

-- DropIndex
DROP INDEX "webhook_events_deletedAt_idx";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "oldValues" SET DATA TYPE JSONB,
ALTER COLUMN "newValues" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "idempotency_keys" ALTER COLUMN "responseBody" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" DROP DEFAULT;
