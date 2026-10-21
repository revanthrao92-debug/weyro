-- Add an index for refresh-token lookups by hash
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- Persist the provider verification audit trail
ALTER TABLE "provider_profiles" ADD COLUMN "verifiedBy" TEXT;
ALTER TABLE "provider_profiles" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "provider_profiles" ADD COLUMN "auditorNotes" TEXT;
