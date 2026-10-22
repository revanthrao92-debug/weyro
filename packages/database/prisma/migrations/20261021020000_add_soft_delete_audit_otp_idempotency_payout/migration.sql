-- Add soft delete (deletedAt) to all existing tables
-- Create missing push_tokens table. The model existed in schema.prisma but was
-- never created by the init migration, so `migrate deploy` failed here.
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceOs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "customer_profiles" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "provider_profiles" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "service_requests" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "request_media" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "quotations" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "reviews" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "spare_parts" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "threads" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "push_tokens" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "refresh_tokens" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "webhook_events" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Add escrow payout fields to payments
ALTER TABLE "payments" ADD COLUMN "payoutReference" TEXT;
ALTER TABLE "payments" ADD COLUMN "paidToProviderAt" TIMESTAMP(3);

-- Create indexes for deletedAt columns
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
CREATE INDEX "customer_profiles_deletedAt_idx" ON "customer_profiles"("deletedAt");
CREATE INDEX "vehicles_deletedAt_idx" ON "vehicles"("deletedAt");
CREATE INDEX "provider_profiles_deletedAt_idx" ON "provider_profiles"("deletedAt");
CREATE INDEX "service_requests_deletedAt_idx" ON "service_requests"("deletedAt");
CREATE INDEX "request_media_deletedAt_idx" ON "request_media"("deletedAt");
CREATE INDEX "quotations_deletedAt_idx" ON "quotations"("deletedAt");
CREATE INDEX "bookings_deletedAt_idx" ON "bookings"("deletedAt");
CREATE INDEX "payments_deletedAt_idx" ON "payments"("deletedAt");
CREATE INDEX "reviews_deletedAt_idx" ON "reviews"("deletedAt");
CREATE INDEX "spare_parts_deletedAt_idx" ON "spare_parts"("deletedAt");
CREATE INDEX "threads_deletedAt_idx" ON "threads"("deletedAt");
CREATE INDEX "messages_deletedAt_idx" ON "messages"("deletedAt");
CREATE INDEX "notifications_deletedAt_idx" ON "notifications"("deletedAt");
CREATE INDEX "push_tokens_deletedAt_idx" ON "push_tokens"("deletedAt");
CREATE INDEX "refresh_tokens_deletedAt_idx" ON "refresh_tokens"("deletedAt");
CREATE INDEX "webhook_events_deletedAt_idx" ON "webhook_events"("deletedAt");

-- Create audit_logs table
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSON,
    "newValues" JSON,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- Create otps table
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "otps_phone_key" ON "otps"("phone");
CREATE INDEX "otps_expiresAt_idx" ON "otps"("expiresAt");

-- Create idempotency_keys table
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestHash" TEXT,
    "responseStatus" INTEGER,
    "responseBody" JSON,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");
CREATE INDEX "idempotency_keys_userId_idx" ON "idempotency_keys"("userId");
CREATE INDEX "idempotency_keys_endpoint_idx" ON "idempotency_keys"("endpoint");
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");
