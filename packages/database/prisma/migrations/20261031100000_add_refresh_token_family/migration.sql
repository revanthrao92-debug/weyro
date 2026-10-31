-- M3: refresh-token rotation families. Every token minted from one login
-- session shares familyId; reuse of an already-rotated token revokes the
-- whole family. Backward-safe: existing rows become their own family root.
ALTER TABLE "refresh_tokens" ADD COLUMN "familyId" TEXT NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");
