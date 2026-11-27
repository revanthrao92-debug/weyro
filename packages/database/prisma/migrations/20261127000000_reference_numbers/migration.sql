-- Weyro reference numbers: <type>-<YYMMDD>-<count>-<check>, e.g. J-261127-0042-6.
-- The database assigns them so no code path can forget one or make a duplicate.
-- Same formula as packages/api-contracts/src/ref.ts (keep them identical):
--   type digit R1 Q2 J3 O4 T5 P6 F7, India date, count padded to 4+ digits,
--   Damm check digit over type digit + date + count.

-- One counter per type per India day. INSERT ... ON CONFLICT ... RETURNING is a single atomic
-- row update: safe with many API servers, and it rolls back with the transaction it belongs to.
CREATE TABLE "ref_counters" (
  "type"  CHAR(1) NOT NULL,
  "day"   CHAR(6) NOT NULL,
  "value" INTEGER NOT NULL,
  CONSTRAINT "ref_counters_pkey" PRIMARY KEY ("type", "day")
);

CREATE FUNCTION weyro_damm(digits TEXT) RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  t CONSTANT INTEGER[] := ARRAY[
    0,3,1,7,5,9,8,6,4,2,
    7,0,9,2,1,5,4,8,6,3,
    4,2,0,6,8,7,1,3,5,9,
    1,7,5,0,9,8,3,4,2,6,
    6,1,2,3,0,4,5,9,7,8,
    3,6,7,4,2,0,9,5,8,1,
    5,8,6,9,7,2,0,1,3,4,
    8,9,4,5,3,6,2,0,1,7,
    9,4,3,8,6,1,7,2,0,5,
    2,5,8,1,4,3,6,7,9,0];
  interim INTEGER := 0;
  i INTEGER;
BEGIN
  FOR i IN 1..length(digits) LOOP
    interim := t[interim * 10 + (ascii(substr(digits, i, 1)) - 48) + 1];
  END LOOP;
  RETURN interim;
END $$;

-- "at" is a UTC wall-clock timestamp (how Prisma stores DateTime); the day is taken in India time.
CREATE FUNCTION weyro_next_ref(ref_type CHAR(1), at TIMESTAMP) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  type_digit INTEGER := position(ref_type IN 'RQJOTPF');
  ref_day CHAR(6) := to_char((at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYMMDD');
  n INTEGER;
  padded TEXT;
BEGIN
  IF type_digit = 0 THEN
    RAISE EXCEPTION 'Unknown reference type %', ref_type;
  END IF;
  INSERT INTO "ref_counters" ("type", "day", "value") VALUES (ref_type, ref_day, 1)
  ON CONFLICT ("type", "day") DO UPDATE SET "value" = "ref_counters"."value" + 1
  RETURNING "value" INTO n;
  -- lpad() would cut 12345 down to 1234, so only pad when shorter.
  padded := CASE WHEN length(n::TEXT) >= 4 THEN n::TEXT ELSE lpad(n::TEXT, 4, '0') END;
  RETURN ref_type || '-' || ref_day || '-' || padded || '-'
    || weyro_damm(type_digit::TEXT || ref_day || padded)::TEXT;
END $$;

-- Every insert gets a fresh number, whatever the caller sent: the format can't be broken from outside.
CREATE FUNCTION weyro_assign_ref() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW."ref" := weyro_next_ref(TG_ARGV[0]::CHAR(1), COALESCE(NEW."createdAt", (now() AT TIME ZONE 'UTC')));
  RETURN NEW;
END $$;

-- Once given, a number never changes (the one-time backfill below fills empty ones before this exists).
CREATE FUNCTION weyro_keep_ref() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ref" IS DISTINCT FROM OLD."ref" THEN
    RAISE EXCEPTION 'Reference numbers cannot be changed (% stays %)', TG_TABLE_NAME, OLD."ref";
  END IF;
  RETURN NEW;
END $$;

-- Add the column, backfill existing rows in creation order with their own dates, then lock it down.
DO $$
DECLARE
  tbl RECORD;
  r RECORD;
BEGIN
  FOR tbl IN SELECT * FROM (VALUES
    ('service_requests', 'R'), ('quotations', 'Q'), ('bookings', 'J'), ('spare_part_orders', 'O'),
    ('driver_bookings', 'T'), ('payments', 'P'), ('refunds', 'F')
  ) AS v(name, letter) LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN "ref" TEXT NOT NULL DEFAULT %L', tbl.name, '');
    FOR r IN EXECUTE format('SELECT "id", "createdAt" FROM %I ORDER BY "createdAt", "id"', tbl.name) LOOP
      EXECUTE format('UPDATE %I SET "ref" = weyro_next_ref(%L, $1) WHERE "id" = $2', tbl.name, tbl.letter)
        USING r."createdAt", r."id";
    END LOOP;
    EXECUTE format('CREATE UNIQUE INDEX %I ON %I ("ref")', tbl.name || '_ref_key', tbl.name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION weyro_assign_ref(%L)',
      tbl.name || '_assign_ref', tbl.name, tbl.letter);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OF "ref" ON %I FOR EACH ROW EXECUTE FUNCTION weyro_keep_ref()',
      tbl.name || '_keep_ref', tbl.name);
  END LOOP;
END $$;
