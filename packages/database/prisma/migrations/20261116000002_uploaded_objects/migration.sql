-- H4: track every finalized upload so media references can be validated
-- (owned by the caller AND actually finalized) before they are stored.

-- CreateTable
CREATE TABLE "uploaded_objects" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_objects_key_key" ON "uploaded_objects"("key");

-- CreateIndex
CREATE INDEX "uploaded_objects_ownerId_idx" ON "uploaded_objects"("ownerId");

-- AddForeignKey
ALTER TABLE "uploaded_objects" ADD CONSTRAINT "uploaded_objects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: keys already stored by earlier releases were finalized by definition.
-- The owner is the user id embedded in the key (<folder>/<userId>/<file>); keys
-- whose owner no longer exists are skipped.
INSERT INTO "uploaded_objects" ("id", "ownerId", "key")
SELECT gen_random_uuid()::text, u."id", k."key"
FROM (
  SELECT "url" AS "key" FROM "request_media"
  UNION SELECT "imageUrl" FROM "spare_parts"
  UNION SELECT "avatarUrl" FROM "customer_profiles"
  UNION SELECT unnest("mediaUrls") FROM "messages"
  UNION SELECT value FROM "provider_profiles", jsonb_each_text("verificationDocuments")
    WHERE jsonb_typeof("verificationDocuments") = 'object'
) k
JOIN "users" u ON u."id" = split_part(k."key", '/', 2)
WHERE k."key" ~ '^(damage-requests|vehicles|avatars|spare-parts|verification-documents)/[^/]+/[A-Za-z0-9._-]+$'
ON CONFLICT ("key") DO NOTHING;
