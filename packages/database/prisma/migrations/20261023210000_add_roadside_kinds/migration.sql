-- Roadside assist sub-kinds with flat-rate estimates.
-- Additive only; existing request rows keep null roadsideKind and their
-- existing towing estimate fields untouched.

-- CreateEnum
CREATE TYPE "RoadsideKind" AS ENUM ('BATTERY', 'TYRE', 'FUEL');

-- AlterTable
ALTER TABLE "service_requests"
    ADD COLUMN "roadsideKind" "RoadsideKind",
    ADD COLUMN "estimatedFare" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "service_requests_roadsideKind_idx" ON "service_requests"("roadsideKind");
