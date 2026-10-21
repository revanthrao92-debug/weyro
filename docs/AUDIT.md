# Weyro Production-Readiness Audit

**Date:** 2026-10-21
**Branch:** `prod-readiness`
**Scope:** Root Expo mobile app, `apps/api` (NestJS), `packages/*`, Prisma schema/migrations, CI, docs.

## Method

Every finding below was re-verified against the current source. Earlier audits contained
claims that were already fixed (listed at the end) and claims that were wrong; those are
not repeated here. Line references are to the commit this audit was written against.

Severity:

- **Critical** — exploitable security/privacy issue, data corruption, or a flow that
  cannot work in production.
- **Important** — correctness, reliability, or operational gap that will bite in production.
- **Nice-to-have** — hardening, cleanup, or long-term maintainability.

---

## Critical

### C1. Mobile token refresh calls a non-existent endpoint
`src/services/api-client.ts:117` calls `POST /auth/refresh-token`; the API exposes
`POST /auth/refresh` (`apps/api/src/modules/auth/auth.controller.ts:27`). Every refresh
fails, so users are logged out when the 15-minute access token expires.
**Fix:** Change the path to `/auth/refresh` and add a test that asserts the URL.

### C2. IDOR in quotation acceptance idempotency path
`apps/api/src/modules/quotations/quotations.service.ts:176-188` returns an existing booking
for a `quotationId` before resolving the quote or checking ownership. Any authenticated
user who knows/guesses a quotation ID can read another customer's booking, provider, and
payments.
**Fix:** Resolve the quote first, verify owner/admin, then return the existing booking.

### C3. Provider feed leaks every competitor's quotation
`apps/api/src/modules/damage-requests/damage-requests.service.ts:149-172` includes
`quotations.provider` (full provider rows) in the nationwide broadcast feed. Any provider
can read all competitors' prices and provider details.
**Fix:** Remove the `quotations` relation from the feed, or select only the caller's quote.

### C4. Request detail leaks all quotations and the booking to non-owner providers
`apps/api/src/modules/damage-requests/damage-requests.service.ts:202-207` includes all
quotations plus `booking`; the "privacy" branch at `:235-247` only redacts the customer.
Any provider with a pending quote sees competitors' pricing and the winning booking.
**Fix:** Filter `quotations` to `providerId === user.providerProfileId` unless owner/admin;
hide `booking` from non-owner providers.

### C5. Offline mutation queue replays fake local IDs
`src/services/damage-request-store.ts:226` creates `req_<timestamp>` IDs and `:286` creates
`q_<timestamp>` IDs. The queue then posts to `/damage-requests/<local-id>/quotations`
(`:312-314`), `/quotations/<local-id>/accept` (`:397-406`), and local booking IDs at `:361`.
The server IDs returned by `POST /damage-requests` are discarded by `offline-queue.ts`.
Quote and acceptance mutations therefore always target non-existent UUIDs; 4xx responses
are silently dropped at `src/services/offline-queue.ts:160-166`.
**Fix:** Persist a client-generated UUID/idempotency key, reconcile the server response
into local state, and never enqueue dependent mutations until the parent server ID exists.

### C6. Chat thread creation does not verify `requestId` ownership
`apps/api/src/modules/chat/chat.service.ts:26-49` accepts any `requestId` from the caller
and creates a thread with it. A customer can attach a provider to another customer's
service request (and the request's content becomes visible in the thread).
`apps/api/src/modules/chat/chat.service.ts:185` also stores `senderRole: user.role`, so
`BOTH` users produce a role the mobile client does not understand.
**Fix:** Verify `requestId` belongs to `customerProfileId` (or the provider has a quote on
it); reject unknown `providerId`; map `BOTH` to `CUSTOMER`/`PROVIDER` per thread side.

### C7. Webhook idempotency and amount validation are unsound
`apps/api/src/modules/payments/payments.service.ts:182` generates a random `eventId` when
the gateway omits `payload.id`, so duplicate deliveries are processed again. The handler at
`:205-277` never checks that `payload.amount` and `payload.currency` match the stored
payment, so a signed event for a different amount/currency can mutate a payment.
**Fix:** Reject events without a gateway event ID; compare `amount`/`currency` with the
stored payment before updating; keep idempotency inside the same transaction.

### C8. Provider verification is enforced from a stale JWT claim
`apps/api/src/modules/damage-requests/damage-requests.controller.ts:46` and
`apps/api/src/modules/quotations/quotations.controller.ts:32` trust
`user.verificationStatus`, embedded at login (`auth.service.ts:213`). After an admin
verifies, suspends, or rejects a provider, existing tokens keep the old status until
refresh (up to 7 days). Suspended providers can keep quoting.
**Fix:** Gate quoting and broadcast access on a fresh `providerProfile.verificationStatus`
DB read (or an authorization cache with explicit invalidation), not the JWT claim.

### C9. Public spare-parts endpoint exposes provider KYC documents
`apps/api/src/modules/spare-parts/spare-parts.controller.ts:41-45` is `@Public()` and
`apps/api/src/modules/spare-parts/spare-parts.service.ts:64-70` returns
`provider: true`, including `ProviderProfile.verificationDocuments`
(`packages/database/prisma/schema.prisma:184`) and `userId`. This leaks identity documents
to unauthenticated callers.
**Fix:** Select an explicit public provider projection (business name, type, rating,
city/phone if intended); never return `verificationDocuments` or `userId`.

### C10. Upload pipeline does not enforce size, MIME, EXIF, or privacy
`apps/api/src/modules/uploads/uploads.controller.ts:41-56`: size is only checked when
the client volunteers `fileSize`; `folder` is passed through unvalidated; the imported
`presignedUrlQuerySchema` is unused (`:13`). `s3-storage.service.ts:61-74` returns a
permanent public URL, and the `ImageProcessingService` (sharp/EXIF stripping) added earlier
is not wired into the presigned flow. Damage photos can retain GPS EXIF and remain public
forever.
**Fix:** Validate query with the shared schema, scope keys to the authenticated user,
enforce content-length in the signed PUT policy, strip EXIF server-side before publish,
and serve via short-lived signed GET URLs from a private bucket.

### C11. Unauthenticated health/ready endpoints leak internal errors
`apps/api/src/modules/health/health.controller.ts:34-38` returns `err.message` from the
database ping to any caller.
**Fix:** Return a generic `database: "unavailable"` and log the error with the request ID.

---

## Important

### I1. Global Zod validation only covers request bodies
`apps/api/src/common/pipes/zod-validation.pipe.ts:14-16` returns `value` unchanged for
`query`, `param`, and custom metadata. Query values are therefore trusted everywhere
(`chat limit`, `spare-parts condition`, `admin status`, uploads), and `parseInt` results
can be `NaN`.
**Fix:** Validate `query` and `param` with schemas too; coerce numbers in the schema.

### I2. Exception filter leaks internal error messages
`apps/api/src/common/filters/prisma-exception.filter.ts:76,86` sets the response message to
`exception.message` for unknown errors. The filter also re-derives the request ID instead
of reading the one attached by middleware.
**Fix:** Always return a generic message for 5xx, include `requestId`, and log the original
error server-side only.

### I3. No graceful shutdown and duplicated body parsing
`apps/api/src/main.ts:9-17` never calls `app.enableShutdownHooks()`, so Prisma/socket
connections are not drained. A second `express.json()` is registered after Nest's default
parser, which can prevent `req.rawBody` from being populated for webhook signature checks.
**Fix:** Call `enableShutdownHooks()`; register the raw-body parser once (disable Nest's
body parser or use `rawBody: true`).

### I4. Production env validation is too permissive
`apps/api/src/config/env.config.ts:19-22` accepts 16-character JWT secrets; Razorpay and S3
credentials are optional even when `STORAGE_DRIVER=s3` or `NODE_ENV=production`; there is
no cross-field refinement. `CORS_ORIGINS` accepts `*`.
**Fix:** Require 32+ chars, refine required keys by driver/environment, and reject `*` in
production.

### I5. Auth defaults and refresh lifetime are wrong
`apps/api/src/modules/auth/auth.service.ts:72-73` silently places every provider at
Bengaluru (12.9716, 77.5946) when coordinates are omitted, corrupting the geo feed.
`:223` hardcodes a 7-day refresh token instead of using `JWT_REFRESH_EXPIRES_IN`.
**Fix:** Require coordinates for provider registration (or leave null), and parse the
configured expiry.

### I6. Quotation acceptance ignores expiry and validates nothing
`apps/api/src/modules/quotations/quotations.service.ts:169-214` never checks
`request.expiresAt` (quotations have no expiry column), and `scheduledAt` accepts any
date string, including the past. `AcceptQuotationDto.deliveryAddress` is accepted but
unused.
**Fix:** Reject expired requests, validate the scheduled date, and persist or drop
`deliveryAddress` explicitly.

### I7. Booking status metadata is silently discarded
`apps/api/src/modules/quotations/quotations.service.ts:353-357` accepts
`trackingNumber`/`carrierName`, but `:386-398` only writes `status` and timestamps. The
mobile UI shows tracking numbers that the server never stores.
**Fix:** Persist tracking fields on `Booking` (schema + migration) or remove them from the
API contract.

### I8. Quote creation can race and mislabels verification
`apps/api/src/modules/quotations/quotations.service.ts:54-99` does a check-then-create
outside the transaction; a concurrent duplicate hits the unique constraint (surfaces as a
generic P2002). `:106` tells the customer a "verified provider" submitted, regardless of
actual status, and the service-request update is not guarded by state.
**Fix:** Rely on the unique constraint with typed conflict handling; check verification
before notifying; guard the request status update.

### I9. Admin verification writes no audit trail; escrow ledger is fabricated
`apps/api/src/modules/admin/admin.service.ts:74-96` ignores `auditorNotes` (not persisted)
and has no reviewer/audit fields. `getEscrowLedger` derives status from booking state
rather than `Payment` records, so the "escrow" ledger does not reflect money movement.
`getProviders` (`:54`) accepts arbitrary status strings.
**Fix:** Add `verifiedBy`, `verifiedAt`, `auditorNotes` to the model; build the ledger from
payments; validate the status filter.

### I10. Escrow is not implemented
`apps/api/src/modules/payments/payments.service.ts:31-60` creates `PENDING` payments and
verification jumps straight to `CAPTURED`; nothing ever sets `AUTHORIZED`, so the release
branch that requires `AUTHORIZED` never runs. README escrow claims are inaccurate.
**Fix:** Implement authorize/capture/release with gateway support, or mark escrow as
planned in the README.

### I11. Mobile chat never talks to the backend for sends
`src/services/chat-store.ts:74-110` appends messages to an in-memory array only;
`apiClient` is used solely to load threads (`:132`). Messages are never persisted or
delivered; the Socket.IO gateway is unused by the client.
**Fix:** Send through `POST /chat/threads/:id/messages` (or the socket) and reconcile the
server message; subscribe to socket events for delivery.

### I12. Push registration cannot succeed
`app.json:59` contains a non-UUID `projectId` placeholder and
`src/services/notifications.ts:50` calls `getExpoPushTokenAsync()` without a `projectId`.
Expo cannot resolve the EAS project, so no real push token is obtained.
**Fix:** Set the real EAS project ID (UUID) and pass it to `getExpoPushTokenAsync`.

### I13. API base URL and fetch have no failure/timeout handling
`src/services/api-client.ts:15` leaves `API_BASE_URL` possibly `undefined`; `:76` calls
`fetch` with no timeout/abort, so requests can hang indefinitely on poor networks.
**Fix:** Fail fast with a clear config error and add an `AbortController` timeout.

### I14. Idempotency contract is inconsistent and mostly unimplemented
`src/services/offline-queue.ts:143` sends `Idempotency-Key`, while the API only reads
`x-idempotency-key` for quotation acceptance. Create request, quote, status, and review
endpoints ignore idempotency keys.
**Fix:** Standardise one header and enforce a persisted key per mutating endpoint.

### I15. Rate limits are missing on the most abused routes
Only auth register/login and uploads have stricter throttles
(`auth.controller.ts:13,20`, `uploads.controller.ts:22`). Broadcast creation, chat
send/thread creation, quotations, payments, and spare-parts creation use the global
100/min limit.
**Fix:** Add per-route `@Throttle` tiers (write vs read) and per-user buckets where possible.

### I16. Refresh-token lookup is unindexed
`packages/database/prisma/schema.prisma:359-368` indexes `userId` but not `tokenHash`,
which is the lookup key on every refresh.
**Fix:** Add `@@index([tokenHash])` (or `@unique`).

### I17. No soft delete or audit trail
Most models lack `deletedAt`, `createdBy`/`updatedBy`, and there is no audit log for
verification, payments, or status changes. Hard deletes cascade (e.g. provider deletion
removes quotes/bookings via relations).
**Fix:** Add soft-delete fields and an append-only audit table for privileged actions.

### I18. Mobile stores refresh tokens in `localStorage` on web
`src/services/token-storage.ts:21-34` falls back to `localStorage` when SecureStore is
unavailable (web). Any XSS can exfiltrate refresh tokens.
**Fix:** Use an httpOnly cookie flow for web, or treat web as a demo client and document
the limitation; never ship web auth in production.

### I19. Rate/limit and pagination inputs are unvalidated
`apps/api/src/modules/chat/chat.controller.ts:34-41` passes `parseInt(limit)` straight to
Prisma; `spare-parts.service.ts:17` clamps but accepts arbitrary strings; `admin status` is
unchecked.
**Fix:** Validate with Zod `coerce.number().int().min(1).max(50)` and enums.

### I20. Repository/workspace hygiene
Root `package.json` lacks `db:migrate`/`db:generate` scripts (they exist only in
`packages/database`), there is no `.nvmrc`, no `engines`, no `.editorconfig`, and the root
`tsconfig.json` excludes `apps`/`packages` so there is no shared strict base.
**Fix:** Add the missing root scripts/configs and a shared `tsconfig.base.json`.

### I21. Unused mobile dependencies
`@expo/ui`, `expo-device`, `expo-glass-effect`, and `expo-linking` are declared in
`package.json` but not imported anywhere in `src/`.
**Fix:** Remove them and let `expo install --fix` reconcile the lockfile.

### I22. README overstates implemented behavior
`README.md:101-103` claims escrow, marketplace webhook idempotency, and identity
verification; `:116-117` documents `JWT_REFRESH_EXPIRES_IN=30d` and `CORS_ORIGINS=*`
(both wrong defaults); `:180` implies working real-time chat. EXIF stripping is claimed
but not wired.
**Fix:** Mark unimplemented features "planned" and document the real defaults.

### I23. Accessibility coverage is minimal
Only `src/app/index.tsx` and `src/app/auth.tsx` have labels/roles. Quotes, explore, chat,
admin, and profile screens have unlabeled icon buttons and inputs.
**Fix:** Add labels/roles/hints to interactive elements on the remaining screens.

### I24. App icon path and splash branding
`app.json:11` points iOS at `./assets/expo.icon`, which is not a PNG asset path used by
Expo; splash/brand colors still use the old blue palette.
**Fix:** Use a real 1024×1024 PNG and align splash colors with the current theme.

### I25. Test coverage is thin
Only state-machine, payments, uploads, and one integration spec exist. No e2e API suite,
no authz regression tests, no mobile tests, and CI does not provision PostGIS.
**Fix:** Add authz regression tests for C2/C3/C4/C6/C9 and a PostGIS-backed e2e job.

### I26. Native build configuration is incomplete
`eas.json:45,49` still contains `APPLE_APP_ID_PLACEHOLDER` / Android submit placeholders;
`expo-dev-client` is absent, so `eas build --profile development` cannot run a dev client.
**Fix:** Fill real submit IDs before release and add `expo-dev-client` for development builds.

---

## Nice-to-have

### N1. Money is `Decimal(10,2)`, not integer minor units
All monetary columns use Prisma `Decimal` (exact, not float). The original requirement
asked for integer minor units. `Decimal` is safe for correctness; migrating to paise
integers is a larger contract change.
**Fix (optional):** Migrate to `Int` minor units with an explicit `currency` column; until
then document the deviation.

### N2. Request logging is ad-hoc JSON, not pino
`apps/api/src/common/middleware/request-id.middleware.ts:21-29` logs a hand-built JSON
string. No log levels, redaction, or trace propagation.
**Fix:** Adopt `nestjs-pino` with redaction and request IDs.

### N3. Duplicate body parser and Swagger exposure
`main.ts` mounts Swagger unconditionally; docs should be disabled or auth-gated in
production.
**Fix:** Gate `/api/docs` behind `NODE_ENV !== 'production'` or admin auth.

### N4. Cursor pagination is not opaque and can skip rows
Cursor is the raw ID and `skip: 1` is used in several services; concurrent inserts can
reorder results.
**Fix:** Use encoded `(createdAt, id)` cursors.

### N5. No dependency/security scanning
CI runs lint/typecheck/tests but no `npm audit`, Dependabot, or secret scanning.
**Fix:** Add `npm audit --omit=dev`, Dependabot, and gitleaks.

### N6. `graphify-out/` and agent folders
`graphify-out/` is gitignored but present in the working tree; `.claude/` is ignored.
Confirm no generated artifacts are committed and keep them out of release builds.
**Fix:** Leave ignored; document regeneration.

### N7. Mobile app remains at repository root
The app is intentionally at root (`src/app`) with API in `apps/api`. This works but
differs from a conventional `apps/mobile` layout.
**Fix:** Document the deliberate layout or plan a move; do not restructure now.

### N8. No request size limit on non-JSON routes
`main.ts` does not set an explicit body limit for JSON or uploads.
**Fix:** Set `json({ limit: '1mb' })` and rely on presigned uploads for files.

### N9. Socket.IO has no rate limit or payload cap
`chat.gateway.ts` accepts messages without per-socket throttling or `maxHttpBufferSize`.
**Fix:** Add per-socket limits and a payload cap.

### N10. Phone authentication is claimed but email/password is the only login
`README.md:103` implies +91 phone authentication; `LoginSchema` accepts
`emailOrPhone` but there is no OTP flow.
**Fix:** Mark OTP/phone auth as planned or implement it.

---

## Verified as already addressed (no action)

- Root `package.json` no longer declares `prisma`/`@prisma/client`; Prisma lives in
  `packages/database` and `apps/api`.
- PostGIS migration contains GiST indexes and sync triggers
  (`migration.sql:503-526`), and the Prisma schema declares `Unsupported("geography")`.
- Unique constraints exist for `Quotation(requestId, providerId)`,
  `Booking(quotationId)`, `Review(bookingId)`, and `Payment.gatewayOrderId`.
- Global `JwtAuthGuard`, `RolesGuard`, and `ThrottlerGuard` are registered
  (`app.module.ts:54-62`); admin routes use `AdminAuthGuard` + `Roles('ADMIN')`.
- Refresh-token rotation revokes the old token (`auth.service.ts:150-154`).
- `/health` and `/ready` endpoints exist (`health.controller.ts:12,23`).
- Chat WebSocket CORS is restricted to `CORS_ORIGINS` (`chat.gateway.ts:17-31`).
- An EXIF-stripping `ImageProcessingService` exists, but is not wired to uploads (C10).
- Mobile uses `expo-secure-store` on native (`token-storage.ts:17-35`).
- `docs/SECURITY.md`, CI workflow, and root `test`/`typecheck:all` scripts exist.

---

## Suggested remediation order

1. C1 (refresh), C2/C3/C4/C9 (authorization/privacy), C6 (chat ownership).
2. C5/I14 (offline IDs + idempotency), C7/I10 (payments), C8 (verification freshness).
3. C10 (uploads), I1/I2/I3/I4 (input, errors, lifecycle, env).
4. I5-I9, I11-I13, schema indexes/audit.
5. Repo hygiene, tests, docs, remaining nice-to-haves.

---

## Remediation status

Updated as fixes land on `prod-readiness`. "Planned" items are documented in the
README as known limitations rather than silently claimed as done.

| Finding | Status | Notes |
|---------|--------|-------|
| C1 refresh endpoint | Fixed | `07d3cb7` |
| C2 accept IDOR | Fixed | `6a6a0d8`, regression test `7713fec` |
| C3 feed quote leak | Fixed | `6a6a0d8`, regression test `7713fec` |
| C4 detail quote leak | Fixed | `6a6a0d8` |
| C5 offline fake IDs | Fixed | `a0259dd` — create/quote/accept are server-first |
| C6 chat ownership / role | Fixed | `2f8b279`, regression test `7713fec` |
| C7 webhook idempotency | Fixed | `4f31885`, regression test `7713fec` |
| C8 stale verification | Fixed | `12eb190` — DB-backed `VerifiedProviderGuard` |
| C9 spare-parts KYC leak | Fixed | `6a6a0d8`, regression test `7713fec` |
| C10 upload hardening | Mostly fixed | `1f02012` (size, MIME, owner keys, EXIF). Private bucket + signed GET planned |
| C11 ready error leak | Fixed | `dfa7139` |
| I1 query/param validation | Fixed | `7511ecb` |
| I2 exception filter 5xx | Fixed | `dfa7139` |
| I3 shutdown + rawBody | Fixed | `4f31885` |
| I4 env validation | Fixed | `dfa7139` |
| I5 provider coords / refresh ttl | Fixed | `dfa7139` |
| I6 accept expiry / schedule | Fixed | `8c67266`, `d0eebb8` |
| I7 booking tracking | Fixed | `b5c9fdd` |
| I8 quote race / label | Fixed | `0b6cdf5`, regression test `7713fec` |
| I9 admin audit / ledger | Fixed | `62c5821`, `7dd6336` |
| I10 escrow | Planned | Documented in README |
| I11 mobile chat backend | Fixed | `39334a0` |
| I12 push projectId | Fixed (config-dependent) | `a0259dd`; set EAS project ID with `eas init` |
| I13 API client timeout / fail-fast | Fixed | `07d3cb7` |
| I14 idempotency headers | Partial | Both headers sent; request-level keys planned |
| I15 rate limits | Fixed | `7511ecb` |
| I16 refresh token index | Fixed | `62c5821` |
| I17 soft delete / audit | Planned | Documented in README |
| I18 web localStorage tokens | Accepted risk | Web is a dev-only client; documented |
| I19 limit/pagination validation | Fixed | `7511ecb` |
| I20 repo hygiene | Fixed | `8c67266` |
| I21 unused deps | Fixed | `bd5c414` |
| I22 README accuracy | Fixed | `cdb0078` |
| I23 accessibility | Fixed | `347ce2e` |
| I24 icon path | Fixed | `a0259dd` |
| I25 tests | Improved | 79 tests incl. authz regressions (`7713fec`); PostGIS e2e still absent |
| I26 native build config | Fixed | `bd5c414` |
| N1 decimal money | Accepted, documented | Exact INR `Decimal(10,2)` |
| N2 pino logging | Planned | Hand-built JSON request logging |
| N3 Swagger gating | Fixed | `4f31885` |
| N4 opaque cursors | Planned | Raw-id cursors remain |
| N5 dependency scanning | Added | Dependabot config; no CI audit gate yet |
| N6 generated artifacts | Verified ignored | `graphify-out/`, `.claude/` ignored |
| N7 root mobile layout | Accepted, documented | |
| N8 body limits | Fixed | `4f31885` |
| N9 socket payload cap | Fixed | `8eacd55` |
| N10 phone auth claim | Fixed (docs) | OTP marked planned |

