-- H6: accepting two quotes at once could create two bookings for one request.
-- Bookings now carry their request id and the database refuses a second
-- non-cancelled booking for the same request.

-- 1. Add the column and backfill it from the quotation.
ALTER TABLE "bookings" ADD COLUMN "requestId" TEXT;

UPDATE "bookings" b
SET "requestId" = q."requestId"
FROM "quotations" q
WHERE q."id" = b."quotationId";

-- 2. Refuse to continue (loudly) if the bug already produced duplicates. Those
--    rows may carry payments, so they must be reconciled by a human, not by a
--    migration silently cancelling or deleting bookings.
DO $$
DECLARE
  dup RECORD;
  report TEXT := '';
BEGIN
  FOR dup IN
    SELECT "requestId", count(*) AS n, string_agg("id", ', ' ORDER BY "createdAt") AS booking_ids
    FROM "bookings"
    WHERE "status" <> 'CANCELLED'
    GROUP BY "requestId"
    HAVING count(*) > 1
  LOOP
    report := report || format(E'\n  request %s has %s active bookings: %s', dup."requestId", dup.n, dup.booking_ids);
  END LOOP;
  IF report <> '' THEN
    RAISE EXCEPTION 'Cannot enforce one active booking per request. Cancel or merge the duplicates, then re-run the migration:%', report;
  END IF;
END $$;

-- 3. Constraints.
ALTER TABLE "bookings" ALTER COLUMN "requestId" SET NOT NULL;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "bookings_requestId_idx" ON "bookings"("requestId");

-- One non-cancelled booking per service request (partial unique index; Prisma
-- cannot model this, so it lives only in SQL).
CREATE UNIQUE INDEX "bookings_one_active_per_request"
  ON "bookings"("requestId")
  WHERE "status" <> 'CANCELLED';
