-- STEP 8 — GiST indexes on PostGIS geography columns used for feed matching.
-- Existing provider.feed / broadcast / lookups filter by distance — a
-- GiST index converts those O(N) sequential scans to index lookups.
CREATE INDEX IF NOT EXISTS "provider_profiles_location_gix"
  ON "provider_profiles" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "service_requests_location_gix"
  ON "service_requests" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "service_requests_dropoffLocation_gix"
  ON "service_requests" USING GIST ("dropoffLocation");
