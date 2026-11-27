-- Non-personal event history: every record created and every status change, written by the
-- database itself so no code path can skip it. Used for the admin timeline and, exported nightly,
-- as a training dataset. See docs/DATA.md for what is kept and what is left out.
--
-- Never stored here: user ids, names, phones, emails, addresses, exact coordinates, tracking
-- numbers, payment gateway ids, OTPs, vehicle registration numbers. Areas are rounded to
-- 2 decimal places (~1 km). Free text is added separately by the API after cleaning
-- (type = 'text', see scrubTrainingText in @weyro/api-contracts).

CREATE TABLE "events" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "seq"        BIGSERIAL NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  "type"       TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityRef"  TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus"   TEXT,
  "source"     TEXT NOT NULL DEFAULT 'live',
  "data"       JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "events_seq_key" ON "events" ("seq");
CREATE INDEX "events_entityRef_seq_idx" ON "events" ("entityRef", "seq");
CREATE INDEX "events_occurredAt_idx" ON "events" ("occurredAt");

-- Append-only: history is never edited. The one exception is DELETE of a 'text' event, so text
-- cleaned by an older version of the cleaner can be replaced by a better-cleaned copy (and text can
-- be removed on a person's request). Status history can never be deleted.
CREATE FUNCTION weyro_events_append_only() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."type" = 'text' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'The event history cannot be changed or deleted';
END $$;
CREATE TRIGGER "events_append_only" BEFORE UPDATE OR DELETE ON "events"
  FOR EACH ROW EXECUTE FUNCTION weyro_events_append_only();

CREATE FUNCTION weyro_area(lat DOUBLE PRECISION) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$ SELECT round(lat::numeric, 2) $$;

-- The non-personal facts about one record, by table. Each lookup of a related record adds its
-- fields only if that record exists: SELECT ... INTO would set the whole result to NULL when the
-- related row is missing (e.g. a request with no saved vehicle) and lose every fact gathered so far.
CREATE FUNCTION weyro_event_data(tbl TEXT, r JSONB) RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
  d JSONB := '{}';
BEGIN
  IF tbl = 'service_requests' THEN
    d := jsonb_build_object(
      'category', r->>'category', 'urgency', r->>'urgency', 'isBroadcast', (r->>'isBroadcast')::boolean,
      'fulfillmentType', r->>'fulfillmentType', 'roadsideKind', r->>'roadsideKind',
      'estimatedFare', (r->>'estimatedFare')::numeric,
      'towingVehicleType', r->>'towingVehicleType', 'vehicleWeightKg', (r->>'vehicleWeightKg')::int,
      'towingDistanceKm', (r->>'towingDistanceKm')::numeric, 'towingEstimatedFare', (r->>'towingEstimatedFare')::numeric,
      'vehicleMake', r->>'vehicleMake', 'vehicleModel', r->>'vehicleModel', 'vehicleYear', (r->>'vehicleYear')::int,
      'areaLat', weyro_area((r->>'latitude')::float8), 'areaLng', weyro_area((r->>'longitude')::float8),
      'dropoffAreaLat', weyro_area((r->>'dropoffLatitude')::float8), 'dropoffAreaLng', weyro_area((r->>'dropoffLongitude')::float8));
    d := d || COALESCE((SELECT jsonb_build_object('fuelType', v."fuelType", 'transmission', v."transmission")
      FROM vehicles v WHERE v.id = r->>'vehicleId'), '{}');
  ELSIF tbl = 'quotations' THEN
    d := jsonb_build_object(
      'partsCost', (r->>'partsCost')::numeric, 'labourCost', (r->>'labourCost')::numeric,
      'shippingCost', (r->>'shippingCost')::numeric, 'totalCost', (r->>'totalCost')::numeric,
      'partCondition', r->>'partCondition', 'warrantyDays', (r->>'warrantyDays')::int,
      'deliveryMethod', r->>'deliveryMethod', 'startsAt', r->>'startsAt', 'durationHours', (r->>'durationHours')::int);
    d := d || COALESCE((SELECT jsonb_build_object('requestRef', sr.ref, 'category', sr.category)
      FROM service_requests sr WHERE sr.id = r->>'requestId'), '{}');
    d := d || COALESCE((SELECT jsonb_build_object('providerType', p."providerType")
      FROM provider_profiles p WHERE p.id = r->>'providerId'), '{}');
  ELSIF tbl = 'bookings' THEN
    d := jsonb_build_object('scheduledAt', r->>'scheduledAt', 'etaMinutes', (r->>'etaMinutes')::int, 'carrierName', r->>'carrierName');
    d := d || COALESCE((SELECT jsonb_build_object('quoteRef', q.ref, 'totalCost', q."totalCost", 'requestRef', sr.ref, 'category', sr.category)
      FROM quotations q JOIN service_requests sr ON sr.id = q."requestId" WHERE q.id = r->>'quotationId'), '{}');
    d := d || COALESCE((SELECT jsonb_build_object('providerType', p."providerType")
      FROM provider_profiles p WHERE p.id = r->>'providerId'), '{}');
  ELSIF tbl = 'spare_part_orders' THEN
    d := jsonb_build_object(
      'quantity', (r->>'quantity')::int, 'unitPrice', (r->>'unitPrice')::numeric, 'totalAmount', (r->>'totalAmount')::numeric,
      'currency', r->>'currency', 'fulfillmentStatus', r->>'fulfillmentStatus', 'carrierName', r->>'carrierName',
      'shippingCity', r->>'shippingCity');
    d := d || COALESCE((SELECT jsonb_build_object('partName', s.name, 'partKind', s.kind, 'partCondition', s.condition,
        'compatibleMakes', to_jsonb(s."compatibleMakes"), 'compatibleModels', to_jsonb(s."compatibleModels"))
      FROM spare_parts s WHERE s.id = r->>'sparePartId'), '{}');
  ELSIF tbl = 'driver_bookings' THEN
    d := jsonb_build_object(
      'engagement', r->>'engagement', 'scheduleMode', r->>'scheduleMode', 'startAt', r->>'startAt', 'endAt', r->>'endAt',
      'durationHours', (r->>'durationHours')::int, 'durationDays', (r->>'durationDays')::int, 'transmission', r->>'transmission',
      'baseAmount', (r->>'baseAmount')::numeric, 'platformFee', (r->>'platformFee')::numeric,
      'totalAmount', (r->>'totalAmount')::numeric, 'driverEarning', (r->>'driverEarning')::numeric,
      'pickupAreaLat', weyro_area((r->>'pickupLatitude')::float8), 'pickupAreaLng', weyro_area((r->>'pickupLongitude')::float8),
      'destinationAreaLat', weyro_area((r->>'destinationLatitude')::float8),
      'destinationAreaLng', weyro_area((r->>'destinationLongitude')::float8));
    d := d || COALESCE((SELECT jsonb_build_object('vehicleMake', v.make, 'vehicleModel', v.model, 'vehicleYear', v.year, 'fuelType', v."fuelType")
      FROM vehicles v WHERE v.id = r->>'vehicleId'), '{}');
  ELSIF tbl = 'payments' THEN
    d := jsonb_build_object('amount', (r->>'amount')::numeric, 'currency', r->>'currency', 'method', r->>'method');
    d := d || COALESCE((SELECT jsonb_build_object('jobRef', b.ref)
      FROM bookings b WHERE b.id = r->>'bookingId'), '{}');
  ELSIF tbl = 'refunds' THEN
    d := jsonb_build_object('amount', (r->>'amount')::numeric, 'currency', r->>'currency');
    d := d || COALESCE((SELECT jsonb_build_object('paymentRef', p.ref)
      FROM payments p WHERE p.id = r->>'paymentId'), '{}');
  END IF;
  RETURN jsonb_strip_nulls(COALESCE(d, '{}'));
END $$;

-- AFTER trigger: one 'created' event per insert; one 'status_changed' per status change;
-- for parts orders also one 'fulfillment_changed' per delivery step.
CREATE FUNCTION weyro_record_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  entity TEXT := TG_ARGV[0];
  r JSONB := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "events" ("type", "entityType", "entityRef", "toStatus", "data")
    VALUES ('created', entity, NEW.ref, r->>'status', weyro_event_data(TG_TABLE_NAME, r));
    RETURN NULL;
  END IF;
  IF (to_jsonb(OLD)->>'status') IS DISTINCT FROM (r->>'status') THEN
    INSERT INTO "events" ("type", "entityType", "entityRef", "fromStatus", "toStatus", "data")
    VALUES ('status_changed', entity, NEW.ref, to_jsonb(OLD)->>'status', r->>'status', weyro_event_data(TG_TABLE_NAME, r));
  END IF;
  IF TG_TABLE_NAME = 'spare_part_orders'
     AND (to_jsonb(OLD)->>'fulfillmentStatus') IS DISTINCT FROM (r->>'fulfillmentStatus') THEN
    INSERT INTO "events" ("type", "entityType", "entityRef", "fromStatus", "toStatus", "data")
    VALUES ('fulfillment_changed', entity, NEW.ref, to_jsonb(OLD)->>'fulfillmentStatus', r->>'fulfillmentStatus',
            weyro_event_data(TG_TABLE_NAME, r));
  END IF;
  RETURN NULL;
END $$;

-- Backfill: rebuild history for existing records from the timestamps they already keep.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('service_requests', 'Request'), ('quotations', 'Quote'), ('bookings', 'Job'), ('spare_part_orders', 'PartsOrder'),
    ('driver_bookings', 'DriverTrip'), ('payments', 'Payment'), ('refunds', 'Refund')
  ) AS v(tbl, entity) LOOP
    EXECUTE format($q$
      INSERT INTO "events" ("occurredAt", "type", "entityType", "entityRef", "toStatus", "source", "data")
      SELECT x."createdAt", 'created', %L, x.ref, NULL, 'backfill', weyro_event_data(%L, to_jsonb(x))
      FROM %I x ORDER BY x."createdAt", x.id $q$, t.entity, t.tbl, t.tbl);
  END LOOP;
END $$;

-- Step times the tables already record (backfilled as status changes, oldest first).
INSERT INTO "events" ("occurredAt", "type", "entityType", "entityRef", "toStatus", "source")
SELECT at, 'status_changed', entity, ref, status, 'backfill' FROM (
  SELECT "startedAt" AS at, 'Job' AS entity, ref, 'IN_PROGRESS' AS status FROM bookings WHERE "startedAt" IS NOT NULL
  UNION ALL SELECT "completedAt", 'Job', ref, 'COMPLETED' FROM bookings WHERE "completedAt" IS NOT NULL
  UNION ALL SELECT "paidAt", 'PartsOrder', ref, 'PAID' FROM spare_part_orders WHERE "paidAt" IS NOT NULL
  UNION ALL SELECT "refundedAt", 'PartsOrder', ref, 'REFUNDED' FROM spare_part_orders WHERE "refundedAt" IS NOT NULL
  UNION ALL SELECT "acceptedAt", 'DriverTrip', ref, 'CONFIRMED' FROM driver_bookings WHERE "acceptedAt" IS NOT NULL
  UNION ALL SELECT "enRouteAt", 'DriverTrip', ref, 'DRIVER_EN_ROUTE' FROM driver_bookings WHERE "enRouteAt" IS NOT NULL
  UNION ALL SELECT "arrivedAt", 'DriverTrip', ref, 'ARRIVED' FROM driver_bookings WHERE "arrivedAt" IS NOT NULL
  UNION ALL SELECT "startedAt", 'DriverTrip', ref, 'IN_PROGRESS' FROM driver_bookings WHERE "startedAt" IS NOT NULL
  UNION ALL SELECT "completedAt", 'DriverTrip', ref, 'COMPLETED' FROM driver_bookings WHERE "completedAt" IS NOT NULL
  UNION ALL SELECT "cancelledAt", 'DriverTrip', ref, 'CANCELLED' FROM driver_bookings WHERE "cancelledAt" IS NOT NULL
  UNION ALL SELECT "paidAt", 'Payment', ref, 'CAPTURED' FROM payments WHERE "paidAt" IS NOT NULL
) steps ORDER BY at;

INSERT INTO "events" ("occurredAt", "type", "entityType", "entityRef", "toStatus", "source")
SELECT at, 'fulfillment_changed', 'PartsOrder', ref, status, 'backfill' FROM (
  SELECT "shippedAt" AS at, ref, 'SHIPPED' AS status FROM spare_part_orders WHERE "shippedAt" IS NOT NULL
  UNION ALL SELECT "deliveredAt", ref, 'DELIVERED' FROM spare_part_orders WHERE "deliveredAt" IS NOT NULL
) steps ORDER BY at;

-- Live recording from now on.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('service_requests', 'Request'), ('quotations', 'Quote'), ('bookings', 'Job'), ('spare_part_orders', 'PartsOrder'),
    ('driver_bookings', 'DriverTrip'), ('payments', 'Payment'), ('refunds', 'Refund')
  ) AS v(tbl, entity) LOOP
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION weyro_record_event(%L)',
      t.tbl || '_record_event', t.tbl, t.entity);
  END LOOP;
END $$;
