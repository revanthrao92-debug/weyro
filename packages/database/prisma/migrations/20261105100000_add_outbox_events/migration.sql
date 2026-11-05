-- STEP 5 — Transactional outbox table.
CREATE TABLE "outbox_events" (
    "id"             TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "payload"        JSONB NOT NULL,
    "channel"        TEXT NOT NULL DEFAULT 'expo-push',
    "attempts"       INTEGER NOT NULL DEFAULT 0,
    "maxAttempts"    INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt"         TIMESTAMP(3),
    "failedAt"       TIMESTAMP(3),
    "lastError"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_events_channel_sentAt_nextAttemptAt_idx"
    ON "outbox_events"("channel", "sentAt", "nextAttemptAt");
CREATE INDEX "outbox_events_type_idx" ON "outbox_events"("type");
