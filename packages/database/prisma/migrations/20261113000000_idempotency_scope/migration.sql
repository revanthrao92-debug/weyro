-- DropIndex
DROP INDEX "idempotency_keys_key_key";

-- AlterTable
ALTER TABLE "idempotency_keys" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_scope_key" ON "idempotency_keys"("key", "scope");

