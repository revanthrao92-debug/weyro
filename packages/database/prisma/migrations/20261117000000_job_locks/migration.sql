-- Lease lock for scheduled jobs (replaces session advisory locks, which
-- leak across pooled connections).
CREATE TABLE "job_locks" (
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_locks_pkey" PRIMARY KEY ("name")
);
