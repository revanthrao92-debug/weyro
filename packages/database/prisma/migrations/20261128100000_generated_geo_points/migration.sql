-- Map points are now computed by the database from latitude/longitude. Before, the app wrote
-- latitude/longitude but not the point, so a business that moved kept matching at its old place
-- (matching preferred the stored point) and new rows had no point, leaving the GiST indexes unused.
-- A generated column cannot go stale and needs no code to keep it in step.

DROP INDEX IF EXISTS "provider_profiles_location_gix";
ALTER TABLE "provider_profiles" DROP COLUMN IF EXISTS "location";
ALTER TABLE "provider_profiles" ADD COLUMN "location" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography) STORED;
CREATE INDEX "provider_profiles_location_gix" ON "provider_profiles" USING GIST ("location");

DROP INDEX IF EXISTS "service_requests_location_gix";
ALTER TABLE "service_requests" DROP COLUMN IF EXISTS "location";
ALTER TABLE "service_requests" ADD COLUMN "location" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography) STORED;
CREATE INDEX "service_requests_location_gix" ON "service_requests" USING GIST ("location");

-- NULL when the request has no drop-off (ST_MakePoint returns NULL for NULL input).
DROP INDEX IF EXISTS "service_requests_dropoffLocation_gix";
ALTER TABLE "service_requests" DROP COLUMN IF EXISTS "dropoffLocation";
ALTER TABLE "service_requests" ADD COLUMN "dropoffLocation" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("dropoffLongitude", "dropoffLatitude"), 4326)::geography) STORED;
CREATE INDEX "service_requests_dropoffLocation_gix" ON "service_requests" USING GIST ("dropoffLocation");
