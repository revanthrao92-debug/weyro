-- Shop listings generalize: SparePart rows may now be PART or PACKAGE.
-- Additive only; existing rows default to PART and behave as before.

-- CreateEnum
CREATE TYPE "ShopListingKind" AS ENUM ('PART', 'PACKAGE');

-- AlterTable
ALTER TABLE "spare_parts"
    ADD COLUMN "kind" "ShopListingKind" NOT NULL DEFAULT 'PART',
    ADD COLUMN "description" TEXT,
    ADD COLUMN "estimatedMinutes" INTEGER;

-- CreateIndex (catalog filter performance)
CREATE INDEX "spare_parts_kind_idx" ON "spare_parts"("kind");
