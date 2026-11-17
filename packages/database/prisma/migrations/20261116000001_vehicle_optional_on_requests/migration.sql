-- C4: stop auto-creating placeholder vehicles.
--  * ServiceRequest.vehicleId becomes optional; free-form make/model/year columns
--    carry vehicle details for requests without a saved vehicle.
--  * Vehicle registration numbers are normalized (uppercase, no whitespace) and
--    unique PER CUSTOMER instead of globally, so one customer's plate can never
--    block (or be guessed by) another.

-- Drop the global unique index first so normalizing cannot collide with it.
DROP INDEX "vehicles_registrationNumber_key";

-- Normalize existing plates.
UPDATE "vehicles"
SET "registrationNumber" = upper(regexp_replace("registrationNumber", '\s+', '', 'g'));

-- Normalization can make two spellings of one customer's plate identical.
-- Keep the oldest row, repoint everything that references the duplicates, then
-- delete them, so the new per-customer unique index can always be created.
CREATE TEMP TABLE "_vehicle_dups" ON COMMIT DROP AS
SELECT "id", "keep_id"
FROM (
  SELECT "id",
         first_value("id") OVER (
           PARTITION BY "customerId", "registrationNumber"
           ORDER BY "createdAt", "id"
         ) AS "keep_id"
  FROM "vehicles"
) ranked
WHERE "id" <> "keep_id";

UPDATE "service_requests" sr
SET "vehicleId" = d."keep_id"
FROM "_vehicle_dups" d
WHERE sr."vehicleId" = d."id";

UPDATE "driver_bookings" db
SET "vehicleId" = d."keep_id"
FROM "_vehicle_dups" d
WHERE db."vehicleId" = d."id";

DELETE FROM "vehicles" WHERE "id" IN (SELECT "id" FROM "_vehicle_dups");

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "vehicleMake" TEXT,
ADD COLUMN     "vehicleModel" TEXT,
ADD COLUMN     "vehicleYear" INTEGER,
ALTER COLUMN "vehicleId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_customerId_registrationNumber_key" ON "vehicles"("customerId", "registrationNumber");
