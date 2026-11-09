# Weyro Backend → Frontend Connection Plan

**Status:** Backend-only monorepo (frontend removed). All API endpoints implemented, privacy shaping applied, 124 tests passing, typecheck clean.

**Goal:** Document exactly what the backend exposes so a frontend team can connect hooks/screens with zero ambiguity. One conventional commit per phase; run gates before declaring each phase done.

---

## 1. Current State Audit

### 1.1 Modules & Endpoints (all live, role-guarded)

| Module | Endpoint | Method | Roles | Privacy-shaped? |
|--------|----------|--------|-------|-----------------|
| **Auth** | `/auth/register` | POST | public | N/A |
| | `/auth/login` | POST | public | N/A |
| | `/auth/send-otp` | POST | public | N/A |
| | `/auth/verify-otp` | POST | public | N/A |
| | `/auth/refresh` | POST | authenticated | N/A |
| | `/auth/logout` | POST | authenticated | N/A |
| | `/auth/me` | GET | authenticated | own profile only |
| **Customers** | `/customers/me` | GET/PATCH | CUSTOMER, BOTH | own data |
| | `/customers/me/addresses` | GET/PUT | CUSTOMER, BOTH | own data |
| | `/customers/me/vehicles` | GET | CUSTOMER, BOTH | own data |
| | `/customers/me/vehicles` | POST | CUSTOMER, BOTH | own data |
| | `/customers/me/vehicles/:id` | PATCH/DELETE | CUSTOMER, BOTH | own data |
| **Providers** | `/providers/me` | GET/PATCH | PROVIDER, BOTH | own data (incl. docs) |
| | `/providers/:id` | GET | public | **public only** (no phone/address/KYC) |
| | `/providers/:id/reviews` | GET | public | customer first name + initial only |
| **Damage Requests** | `/damage-requests` | POST | CUSTOMER, BOTH, ADMIN | own |
| | `/damage-requests/broadcast-feed` \| `/feed` | GET | PROVIDER, BOTH, ADMIN | filtered by category |
| | `/damage-requests/my` | GET | CUSTOMER, BOTH | own |
| | `/damage-requests/:id/cancel` | POST | CUSTOMER, BOTH, ADMIN | own |
| | `/damage-requests/:id` | GET | CUSTOMER, BOTH, PROVIDER, ADMIN | competitor quotes hidden; provider row → public |
| **Quotations** | `/damage-requests/:requestId/quotations` | POST | PROVIDER, BOTH, ADMIN | verified guard |
| | `/damage-requests/:requestId/quotations` | GET | all authenticated | provider row → public |
| | `/quotations/:id/accept` | POST | CUSTOMER, BOTH, ADMIN | idempotent |
| | `/quotations/my` | GET | PROVIDER, BOTH, ADMIN | own quotes |
| | `/quotations/:id/withdraw` | POST | PROVIDER, BOTH, ADMIN | own, PENDING only |
| **Bookings** | `/bookings` \| `/quotations/bookings` | GET | all | cross-party shaped |
| | `/bookings/:id` \| `/quotations/bookings/:id` | GET | participant / ADMIN | cross-party shaped |
| | `/bookings/:id/status` | PATCH | participant / ADMIN | state-machine enforced |
| | `/bookings/:id/location` | PATCH | PROVIDER, BOTH, ADMIN | provider only |
| | `/bookings/:id/tracking` | GET | participant / ADMIN | provider lat/lng |
| | `/bookings/:id/reviews` | POST | CUSTOMER, BOTH, ADMIN | one per booking |
| **Chat** | `/chat/threads` | POST/GET | CUSTOMER, BOTH | phone/address stripped |
| | `/chat/unread-count` | GET | all | scoped to user threads |
| | `/chat/threads/:id/messages` | GET/POST | participant | — |
| | `/chat/threads/:id/read` | PATCH | participant | — |
| **Notifications** | `/notifications/push-token` | POST/DELETE | authenticated | — |
| | `/notifications/unread-count` | GET | authenticated | — |
| | `/notifications/read-all` | PATCH | authenticated | — |
| | `/notifications/:id/read` | PATCH | authenticated | — |
| **Spare Parts** | `/spare-parts` | GET | public | active only |
| | `/spare-parts/mine` | GET | PROVIDER, BOTH, ADMIN | own (incl. inactive) |
| | `/spare-parts/:id` | GET/DELETE | public / owner | soft-delete |
| | `/spare-parts` | POST | PROVIDER, BOTH, ADMIN | — |
| | `/spare-parts/:id` | PATCH | owner / ADMIN | stockQuantity locked to 1 for PACKAGE |
| | `/spare-parts/orders/my` | GET | CUSTOMER, BOTH | own |
| | `/spare-parts/orders/dealer` | GET | PROVIDER, BOTH, ADMIN | own |
| | `/spare-parts/orders/admin/all` | GET | ADMIN | all |
| | `/spare-parts/orders/:orderId` | GET | participant / ADMIN | masked |
| | `/spare-parts/orders` | POST | CUSTOMER, BOTH | creates gateway order |
| | `/spare-parts/orders/:orderId/verify` | POST | CUSTOMER, BOTH, ADMIN | Razorpay signature |
| | `/spare-parts/orders/:orderId/cancel` | POST | CUSTOMER, BOTH, ADMIN | — |
| | `/spare-parts/orders/:orderId/refund` | POST | ADMIN | restores stock |
| **Payments** | `/payments/create-order` | POST | authenticated | Razorpay order |
| | `/payments/verify` | POST | authenticated | Razorpay signature |
| | `/payments/release` | POST | ADMIN | escrow payout |
| | `/payments/webhook` | POST | public (300/min) | idempotent |
| **Admin** | `/admin/overview` | GET | ADMIN | metrics |
| | `/admin/providers` | GET | ADMIN | list (docs stripped) |
| | `/admin/providers/:id` | GET | ADMIN | full detail + docs |
| | `/admin/providers/:id/verify` | PATCH | ADMIN | — |
| | `/admin/escrow-ledger` | GET | ADMIN | incl. RELEASED |
| | `/admin/activity-logs` \| `/activity-stats` | GET | ADMIN | — |
| **Uploads** | `/uploads/presigned-url` | GET | authenticated | S3 PUT |
| | `/uploads/presigned-download-url` | GET | authenticated | S3 GET |
| | `/uploads/finalize` | POST | authenticated | — |
| **Health** | `/health` \| `/ready` | GET | public | — |

### 1.2 Privacy guarantees (P0, enforced)
- **Customers never see**: provider phone, exact address, KYC/verificationDocuments, auditor notes, gateway IDs.
- **Providers never see**: customer savedAddresses, userId, phone (except after booking acceptance where justified).
- **Public provider pages** (`/providers/:id`): marketing-safe projection only (businessName, badge, rating, availability, towing capabilities).
- **Admin**: sees everything including verificationDocuments and full escrow ledger.

### 1.3 What is NOT yet implemented (gaps)
| Gap | Why it matters | Phase |
|-----|---------------|-------|
| Booking payment summary embedded in booking detail | Frontend needs "pay now" status + amount on booking screen | H2 |
| Escrow release confirmation flow (customer-side) | Frontend needs to trigger release after job completion | H2 |
| Review list for a booking (GET) | Frontend needs to show existing review before editing | H6 |
| Provider earnings/payout statement | Frontend provider "Earnings" screen | H6 |
| Spare-parts CSV import / low-stock alerts | Dealer inventory management | H5 (deferred) |
| Real Razorpay test-mode transaction | Requires user credentials; blocked externally | — |
| Physical device pass | Requires user; blocked externally | — |

---

## 2. Frontend Feature → Backend Endpoint Mapping

| Frontend Feature | Screens | Backend Endpoints | Status |
|-----------------|---------|-------------------|--------|
| **F1 Navigation + Auth** | Login, register, OTP, role switch | `/auth/*` | ✅ Ready |
| **F2 Booking payment + escrow release** | Checkout, payment, release confirmation | `/payments/create-order`, `/payments/verify`, `/payments/release`, `/bookings/:id` | ⚠️ Booking payment summary needed |
| **F3 Notifications inbox** | Bell, inbox, mark read | `/notifications/*`, `/chat/unread-count` | ✅ Ready |
| **F4 Profile / Vehicles** | Edit profile, addresses, garage | `/customers/me*`, `/providers/me` | ✅ Ready |
| **F5 Shop / Dealer inventory** | Parts list, part detail, add/edit, orders | `/spare-parts/*`, `/spare-parts/orders/*` | ✅ Ready |
| **F6 Requests / Quotes** | Create request, broadcast feed, quote detail, accept, withdraw | `/damage-requests/*`, `/quotations/*` | ✅ Ready |
| **F7 Bookings / Jobs** | My bookings, booking detail, tracking, status, review | `/bookings/*` | ✅ Ready |
| **Chat / Messages** | Thread list, conversation | `/chat/*` | ✅ Ready |
| **Admin** | Provider verification, escrow ledger, overview | `/admin/*` | ✅ Ready |

---

## 3. Phased Implementation Plan (backend only)

### Phase H0 — Privacy & Contracts ✅ (COMPLETED, committed)
- Shared public serializers (`toPublicProvider`, `toPublicCustomer`, `toPaymentSummary`)
- Role-shaped booking responses (customer sees public provider; provider sees public customer; admin sees full)
- Damage-request quotation provider shaping (competitor quotes hidden from providers)
- Chat thread shaping (phone/address stripped from both parties)
- Admin escrow ledger includes `RELEASED` payments + payout fields
- Contracts updated: `PublicProvider`, `PublicCustomer`, `PaymentSummary`, `EscrowLedgerEntry` extra fields, `AdminProviderDetail`, `SavedAddress`, `VehicleInput`, `NotificationItem`, `ProviderReview`
- Unit tests for serializers + privacy assertions
- **Commit:** `71b9f85 fix(api): stop leaking cross-party data in shared responses`

### Phase H1 — Profile & Vehicles ✅ (COMPLETED, committed)
- `CustomersModule`: `GET/PATCH /customers/me`, `GET/PUT /customers/me/addresses`, `GET/POST/PATCH/DELETE /customers/me/vehicles`
- `ProvidersModule`: `GET/PATCH /providers/me`, `GET /providers/:id` (public), `GET /providers/:id/reviews` (public)
- Registered in `AppModule`
- **Commit:** `84361a6 feat(api): add customer and provider self-service endpoints`

### Phase H2 — Money (payment & escrow) — IN PROGRESS
- **H2.1** Booking detail response must embed `payment: PaymentSummary` (status, amount, method, paidAt, releasedAt) so frontend can show "pay now" or "release funds".
- **H2.2** Verify `/payments/create-order` + `/payments/verify` return a shape the frontend can bind to (orderId, amount, currency, signature fields).
- **H2.3** `/payments/release` (admin) returns updated payment + booking status; frontend admin screen can trigger payout.
- **H2.4** E2E: customer pays for a spare-part order; admin releases escrow; ledger reflects `RELEASED_TO_PROVIDER`.
- **Commit:** one conventional commit when green.

### Phase H3 — Notifications & Chat Unread ✅ (COMPLETED, committed)
- `GET /notifications/unread-count`, `PATCH /notifications/read-all`, `DELETE /notifications/push-token`
- `GET /chat/unread-count`, per-thread `unreadCount` in thread list
- **Commit:** included in `71b9f85`

### Phase H4 — Requests & Quotes ✅ (COMPLETED, committed)
- `POST /damage-requests/:id/cancel` (customer/owner, state-machine enforced)
- `GET /quotations/my` (provider, paginated, status filter)
- `POST /quotations/:id/withdraw` (provider, PENDING only)
- `GET /bookings/:id` (role-checked, shaped)
- E2E: quote withdrawal + request cancellation covered
- **Commit:** included in `2027cb2`

### Phase H5 — Shop Management ✅ (COMPLETED, committed)
- `GET /spare-parts/mine` (provider, incl. inactive, orders count)
- `PATCH /spare-parts/:id` (owner/admin; PACKAGE stock locked to 1)
- `DELETE /spare-parts/:id` (soft delete, ownership-checked)
- E2E: dealer creates/edits/deletes listing; cross-dealer edit blocked (403)
- **Commit:** `79f1659 feat(api): add dealer listing management`

### Phase H6 — Reviews & Admin (REMAINING)
- **H6.1** `GET /bookings/:id/review` — return existing review for a booking (frontend needs to show "edit review within 48h").
- **H6.2** Provider earnings statement: aggregate completed bookings + released payments per provider (for provider "Earnings" screen).
- **H6.3** Admin provider list already strips docs; detail endpoint returns them. ✅
- **Commit:** one conventional commit.

### Phase H7 — Mobile Hooks (frontend-side, deferred)
- This is React Query / custom `useApiQuery` hooks on the mobile side. Not backend work.
- Backend contract is stable; frontend team can generate hooks from the OpenAPI-ish shapes in `packages/api-contracts`.
- **Commit:** none (frontend removed).

---

## 4. Contract Stability

All shared types live in `packages/api-contracts/src/index.ts`. The frontend should import from `@weyro/api-contracts` for:

- `User`, `CustomerProfile`, `Vehicle`, `SavedAddress`
- `ProviderProfile`, `PublicProvider`, `ProviderBadge`
- `ServiceRequest`, `Quotation`, `Booking`, `PaymentSummary`
- `SparePart`, `Review`, `NotificationItem`, `ProviderReview`
- `EscrowLedgerEntry`, `AdminProviderDetail`
- Enums: `UserRole`, `ProviderType`, `VerificationStatus`, `BookingStatus`, `QuotationStatus`, `ServiceCategory`, `PaymentStatus`, `FuelType`, `TowingVehicleType`
- Functions: `computeProviderBadge`, `haversineDistanceKm`, `estimateTowingFare`, `TOWING_TARIFF`, `ROADSIDE_TARIFF`, `PROVIDER_TYPE_CATEGORIES`

**No new DB migrations or enum changes** are planned — existing fields/enums suffice.

---

## 5. Definition of Done (backend ready to connect)

- [ ] `npm run typecheck:all` passes
- [ ] `npm run test -w @weyro/api` passes (unit)
- [ ] E2E with local Postgres/PostGIS passes (port 5433 env vars)
- [ ] No provider phone/address/KYC in any non-admin response (e2e assertion)
- [ ] No customer savedAddresses in any provider response (e2e assertion)
- [ ] Booking detail embeds `PaymentSummary` (H2)
- [ ] Escrow release flow tested end-to-end (H2)
- [ ] All phases H0–H6 committed with conventional messages
- [ ] CI green on `prod-readiness`

---

## 6. Risks & Open Items

| Risk | Mitigation |
|------|------------|
| Real Razorpay test-mode transaction requires user credentials | Blocked externally; use mock gateway in tests |
| Physical device push-token pass requires a real device | Blocked externally; unit-test token CRUD |
| Frontend hook library choice (`useApiQuery` vs `@tanstack/react-query`) | Deferred; backend contract is library-agnostic |
| `BOTH` role produces a role the mobile client may not understand | Documented in audit; frontend must handle `BOTH` |
| `@nestjs/schedule` v12 is ESM-only; mocked in e2e | Keep the mock in `jest-e2e.config.js` |

---

## 7. Next Immediate Move

Run Phase H2 (money/booking payment summary), then H6 (reviews + provider earnings), then commit and push. After that, the backend is "ready to connect" and frontend work can begin.
