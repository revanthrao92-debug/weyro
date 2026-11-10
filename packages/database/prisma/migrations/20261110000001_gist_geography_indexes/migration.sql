-- GiST indexes on PostGIS geography columns used by distance-based feed
-- matching. Prisma cannot express indexes on Unsupported() columns, so they
-- live in SQL.
CREATE INDEX IF NOT EXISTS "provider_profiles_location_gix"
  ON "provider_profiles" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "service_requests_location_gix"
  ON "service_requests" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "service_requests_dropoffLocation_gix"
  ON "service_requests" USING GIST ("dropoffLocation");
