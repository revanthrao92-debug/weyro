# Weyro API Overview

Base URL: `<host>/api/v1` · Auth: `Authorization: Bearer <access token>` (JWT, 15m)
Public (no auth): `/auth/*`, `/health`, `/payments/webhook`, spare-parts browse, provider public profile.
Roles: `CUSTOMER` · `PROVIDER` (dealer/mechanic) · `BOTH` · `ADMIN`.

## Auth (`/auth`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | customer or provider (`providerType` DEALER/MECHANIC) |
| POST | `/auth/login` | public | email/phone + password; 5/min/IP throttle |
| POST | `/auth/send-otp` | public | 10-min validity, resend locked while active; per-IP + per-phone limits |
| POST | `/auth/verify-otp` | public | returns JWT pair; code hashed at rest (HMAC), atomic max-attempts lockout (5) |
| POST | `/auth/refresh` | cookie/body token | rotation families; reuse of a rotated token revokes the family |
| POST | `/auth/reset-password` | public | password reset flow |
| POST | `/auth/logout` | auth | revokes current refresh token |
| GET | `/auth/me` | auth | current user |

## Customers (`/customers`)
GET/PATCH `/customers/me` · GET/PUT `/customers/me/addresses` · GET/POST `/customers/me/vehicles` · PATCH/DELETE `/customers/me/vehicles/:id`

## Damage Requests (`/damage-requests`)
| Method | Path | Roles |
|---|---|---|
| POST | `/damage-requests` | CUSTOMER/BOTH |
| GET | `/damage-requests/feed` · `/broadcast-feed` | PROVIDER (location-aware) |
| GET | `/damage-requests/my` | CUSTOMER |
| GET | `/damage-requests/:id` | owner/provider/admin |
| POST | `/damage-requests/:id/cancel` | owner |

## Quotations & Bookings
| Method | Path | Roles |
|---|---|---|
| POST | `/damage-requests/:requestId/quotations` | PROVIDER |
| GET | `/damage-requests/:requestId/quotations` | request owner / provider / admin |
| POST | `/quotations/:id/accept` | request owner (transactional claim) |
| POST | `/quotations/:id/withdraw` | quoting provider |
| GET | `/quotations/my` | PROVIDER |
| GET | `/bookings` · `/bookings/:id` | authorized parties |
| PATCH | `/bookings/:id/status` | provider/admin (state machine) |
| PATCH | `/bookings/:id/location` | assigned provider |
| GET | `/bookings/:id/tracking` | authorized parties |
| POST | `/bookings/:id/reviews` | booking customer |

## Spare Parts (`/spare-parts`)
GET `/spare-parts` · GET `/spare-parts/:id` · POST/PATCH/DELETE `/spare-parts` (PROVIDER) · GET `/spare-parts/mine` (dealer) · POST `/spare-parts/:id/orders` (CUSTOMER, creates gateway order) · GET `/spare-parts/orders/my` · `/orders/dealer` · `/orders/:orderId` · POST `/orders/:orderId/verify` (client verify with gateway-side amount binding) · POST `/orders/:orderId/cancel` · `/orders/:orderId/refund` (admin)

## Payments (`/payments`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/create-order` | customer | local payment row + Razorpay order |
| POST | `/payments/verify` | booking customer | signature + **server-side fetch binds amount/currency/order**; conditional capture claim |
| POST | `/payments/release` | ADMIN | escrow release; conditional claim (double-release impossible) |
| POST | `/payments/webhook` | public | HMAC over exact raw bytes; independent secret required; event-id idempotency; amount/currency bound |

## Chat (`/chat`)
POST `/chat/threads` · GET `/chat/threads` · GET `/chat/unread-count` · GET `/chat/threads/:id/messages` · POST `/chat/threads/:id/messages` · PATCH `/chat/threads/:id/read`

## Notifications (`/notifications`)
GET `/notifications` (cursor-paged) · GET `/unread-count` · PATCH `/:id/read` · PATCH `/read-all` · POST/DELETE `/push-token` (tokens validated against the Expo format; cross-user token theft rejected; max 5 tokens/user)

## Uploads (`/uploads`)
GET `/uploads/presigned-url` · GET `/uploads/presigned-download-url` · POST `/uploads/finalize` — S3 (prod) / local-mock (dev). Key-ownership + traversal guards.

## Providers (`/providers`)
GET/PATCH `/providers/me` · GET `/providers/:id` (public) · GET `/providers/:id/reviews` (public)

## Admin (`/admin`) — `ADMIN` role only
GET `/admin/overview` · GET `/admin/providers` · PATCH `/admin/providers/:id/verify` · GET `/admin/escrow-ledger` · GET `/admin/activity-logs` · GET `/admin/activity-stats`

## Health
GET `/health` (liveness) · GET `/ready` (DB ping, used by docker healthchecks)
