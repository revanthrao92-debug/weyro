-- Outbox drain claims due rows every 10 s. Sent rows are kept, so the table
-- only grows; this partial index covers just the pending rows, keeping the
-- claim fast regardless of table size. Hand-written: Prisma can't model
-- partial indexes, so it lives only in SQL.
CREATE INDEX "outbox_events_pending_idx"
  ON "outbox_events" ("nextAttemptAt")
  WHERE "sentAt" IS NULL AND "failedAt" IS NULL;
