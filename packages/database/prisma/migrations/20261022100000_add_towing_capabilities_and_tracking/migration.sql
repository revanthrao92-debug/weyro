-- Towing capabilities, distance-based fare fields, and live booking tracking.

-- CreateEnum
CREATE TYPE "TowingVehicleType" AS ENUM ('FLATBED', 'HOOK_AND_CHAIN', 'MOTORCYCLE', 'ANY');

-- AlterTable: provider towing capabilities and tariffs
ALTER TABLE "provider_profiles"
    ADD COLUMN "towingVehicleTypes" "TowingVehicleType"[] NOT NULL DEFAULT ARRAY[]::"TowingVehicleType"[],
    ADD COLUMN "maxVehicleWeightKg" INTEGER,
    ADD COLUMN "towingBaseFee" DECIMAL(10,2),
    ADD COLUMN "towingPerKmFee" DECIMAL(10,2);

-- AlterTable: towing request details
ALTER TABLE "service_requests"
    ADD COLUMN "dropoffAddress" TEXT,
    ADD COLUMN "dropoffLatitude" DOUBLE PRECISION,
    ADD COLUMN "dropoffLongitude" DOUBLE PRECISION,
    ADD COLUMN "dropoffLocation" geography(Point, 4326),
    ADD COLUMN "towingVehicleType" "TowingVehicleType",
    ADD COLUMN "vehicleWeightKg" INTEGER,
    ADD COLUMN "towingDistanceKm" DOUBLE PRECISION,
    ADD COLUMN "towingEstimatedFare" DECIMAL(10,2);

-- AlterTable: live tracking
ALTER TABLE "bookings"
    ADD COLUMN "providerLatitude" DOUBLE PRECISION,
    ADD COLUMN "providerLongitude" DOUBLE PRECISION,
    ADD COLUMN "providerLocationUpdatedAt" TIMESTAMP(3),
    ADD COLUMN "etaMinutes" INTEGER;
