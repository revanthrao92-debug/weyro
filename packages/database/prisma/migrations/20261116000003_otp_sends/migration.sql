-- H5: OTP send log used for per-phone and global send limits (DB fallback when
-- Redis is not configured).

-- CreateTable
CREATE TABLE "otp_sends" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_sends_phone_createdAt_idx" ON "otp_sends"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "otp_sends_createdAt_idx" ON "otp_sends"("createdAt");
