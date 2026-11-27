# Event history and the training dataset

Weyro keeps a permanent, **non-personal** history of everything that happens on the platform:
every request, quote, job, parts order, driver trip, payment and refund, from creation through
each status change. It powers the admin timeline (Operations → any record → "What happened") and
is exported nightly as a dataset that could later be used to train an AI model.

## Where it lives

| What | Where |
| --- | --- |
| History table | `events` (migration `20261128000000_event_history`, Prisma model `Event`) |
| Who writes it | Database triggers on the 7 tables (creation and status changes), so no code path can skip it. The nightly task adds cleaned text. |
| Nightly task | `apps/api/src/modules/tasks/dataset.service.ts`, 02:30 India time, one server only (lock `dataset`) |
| Dataset files | Private storage bucket, `datasets/events/YYYY/MM/DD.jsonl.gz` (one file per India day) |
| Text cleaner | `scrubTrainingText` in `packages/api-contracts/src/training-scrub.ts` |

## What is kept

- **What happened:** event type (`created`, `status_changed`, `fulfillment_changed`, `text`), from/to
  status, time, and the record's Weyro reference number (e.g. `J-261127-0042-6`).
- **Facts about it:** category, urgency, vehicle make/model/year/fuel/transmission, provider type,
  prices and cost breakdowns, quoted start time and duration, warranty, quantities, part
  name/condition/fit, trip length and fares, courier company, delivery city.
- **Area, not location:** latitude/longitude rounded to 2 decimal places (about 1 km).
- **Cleaned text:** request titles and descriptions, quote notes, garage completion notes, review
  comments (with the rating), driver decline reasons. Only the newest cleaned copy per record and field.

## What is never kept

User or profile ids, names, phone numbers, emails, street addresses, exact coordinates, vehicle
registration numbers, tracking numbers, payment gateway ids, OTPs and start codes, chat messages,
and completion notes of parts jobs (those hold the delivery address).

## How text is cleaned

`scrubTrainingText` replaces, in this order:
1. lines the app writes with addresses (`Pickup: …`, `Destination: …`, `Delivery address: …`) and the same labels typed by people;
2. emails;
3. UPI ids;
4. phone numbers (Indian 10-digit with or without `+91`/`0`/spaces, international);
5. OTP-style codes;
6. Aadhaar and PAN numbers;
7. Indian vehicle numbers (real state codes only, so "service at 10000 km" is untouched).

**Limit:** names typed inside free text ("ask for Ramesh") can't be removed reliably.

**When the cleaner improves:** bump `TRAINING_TEXT_CLEANER_VERSION`. The next nightly run then:
1. re-cleans all stored text;
2. deletes the older copies (only `text` events can be deleted; status history can't);
3. removes the day files that held them, so they're written again without the old text.

## Dataset file format

Gzipped JSON lines, one event per line, ordered by `seq`:

```json
{"seq":1042,"occurredAt":"2026-11-27T05:14:09.120Z","type":"status_changed","entityType":"Job",
 "entityRef":"J-261127-0042-6","fromStatus":"CONFIRMED","toStatus":"IN_PROGRESS","source":"live",
 "data":{"category":"REPAIR","providerType":"GARAGE","totalCost":6950,"requestRef":"R-261126-0007-5"}}
```

- `source` is `backfill` for history rebuilt from older records' timestamps (no amounts on step
  events), `live` for everything recorded as it happened.
- Records link through reference numbers: a job's `data.requestRef` and `data.quoteRef`, a payment's `data.jobRef`.
- Text events carry `data.field` (`title`, `description`, `notes`, `completionNotes`, `review`,
  `cancellationReason`), `data.text`, and `data.v` (the cleaner version).

**Rules for the nightly files:**
- a day is written once it's over;
- a day file that exists is never overwritten;
- missed days are caught up, at most 60 per night.

## Size and cost

Each event is a few hundred bytes before compression, so the cost is very small:

| Volume | Size | Cost |
| --- | --- | --- |
| Pilot | A few KB a day | A few rupees a month on S3 |
| 10,000 events a day | Roughly 1–2 MB a day | A few rupees a month on S3 |

The `events` table stays the main copy; the files are the export.

## Before launch: privacy policy (decision for the owner)

India's data protection law (DPDP Act 2023) applies to personal data. This history is designed to
hold none, but the privacy policy should still say plainly that Weyro keeps an anonymised history of
service activity and cleaned request text to improve the service and train models, and how to ask
for text to be removed (deleting a record's `text` events is supported). The wording is the owner's call.
