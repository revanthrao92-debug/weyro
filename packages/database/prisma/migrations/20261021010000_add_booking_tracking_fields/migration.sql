-- Persist shipment tracking metadata supplied during booking status updates
ALTER TABLE "bookings" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "bookings" ADD COLUMN "carrierName" TEXT;
