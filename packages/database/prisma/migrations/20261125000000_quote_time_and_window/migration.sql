-- New quotes close at quotesUntil (24 h); accepting still allowed until expiresAt.
ALTER TABLE "service_requests" ADD COLUMN "quotesUntil" TIMESTAMP(3);

-- Structured quote time: earliest start and job length.
ALTER TABLE "quotations" ADD COLUMN "startsAt" TIMESTAMP(3);
ALTER TABLE "quotations" ADD COLUMN "durationHours" INTEGER;
