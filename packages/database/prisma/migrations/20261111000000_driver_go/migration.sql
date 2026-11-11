-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "DriverEngagement" AS ENUM ('HOURLY', 'DAILY');

-- CreateEnum
CREATE TYPE "DriverScheduleMode" AS ENUM ('ON_DEMAND', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "DriverBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED');

-- AlterEnum
ALTER TYPE "ProviderType" ADD VALUE 'DRIVER';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "transmission" "Transmission";

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "licenceNumber" TEXT,
    "licenceExpiry" TIMESTAMP(3),
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transmissions" "Transmission"[] DEFAULT ARRAY[]::"Transmission"[],
    "hourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dailyRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "maxHoursPerDay" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_availability" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_bookings" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "DriverBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "engagement" "DriverEngagement" NOT NULL,
    "scheduleMode" "DriverScheduleMode" NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION NOT NULL,
    "pickupLongitude" DOUBLE PRECISION NOT NULL,
    "destinationAddress" TEXT,
    "destinationLatitude" DOUBLE PRECISION,
    "destinationLongitude" DOUBLE PRECISION,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationHours" INTEGER,
    "durationDays" INTEGER,
    "notes" TEXT,
    "transmission" "Transmission",
    "baseAmount" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "driverEarning" DECIMAL(10,2) NOT NULL,
    "startOtpHash" TEXT,
    "startOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "driverLatitude" DOUBLE PRECISION,
    "driverLongitude" DOUBLE PRECISION,
    "driverLocationUpdatedAt" TIMESTAMP(3),
    "etaMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "driver_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_providerId_key" ON "driver_profiles"("providerId");

-- CreateIndex
CREATE INDEX "driver_availability_driverId_weekday_idx" ON "driver_availability"("driverId", "weekday");

-- CreateIndex
CREATE INDEX "driver_bookings_driverId_status_idx" ON "driver_bookings"("driverId", "status");

-- CreateIndex
CREATE INDEX "driver_bookings_customerId_createdAt_idx" ON "driver_bookings"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "driver_bookings_status_startAt_idx" ON "driver_bookings"("status", "startAt");

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_availability" ADD CONSTRAINT "driver_availability_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_bookings" ADD CONSTRAINT "driver_bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_bookings" ADD CONSTRAINT "driver_bookings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_bookings" ADD CONSTRAINT "driver_bookings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

