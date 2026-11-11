# Driver Go — driver interface (phase 1)

Driver Go is a driver-booking marketplace inside the existing Weyro app. This
phase implements the **driver experience** and its API against admin-seeded
drivers and sample jobs. The customer booking flow, payments and live tracking
come next.

## Architecture decisions

- **One Expo app, one API.** No separate driver app.
- Driver is a provider capability: `ProviderType.DRIVER` + `DriverProfile`
  linked 1:1 to the existing `ProviderProfile`.
- No new `UserRole`; driver accounts use `PROVIDER`, so auth, verification,
  push and audit stay shared.
- `DriverBooking` is a separate model. The existing `Booking` is quotation-bound
  and must not be bent into a driver ride.
- Driver verification continues to live on `ProviderProfile.verificationStatus`;
  admin approval is the same gate as other providers.

## Data model

`packages/database/prisma/schema.prisma` adds:

- `ProviderType.DRIVER`
- `Transmission`, `DriverEngagement`, `DriverScheduleMode`,
  `DriverBookingStatus`
- `DriverProfile` — licence, experience, languages, transmissions, hourly/daily
  rates, online state, max hours
- `DriverAvailability` — weekly windows (weekday + minutes)
- `DriverBooking` — customer/vehicle/driver, engagement, schedule mode, status,
  pickup/destination, start/end, fare breakdown, start OTP hash/attempts,
  timestamps, driver location fields
- `Vehicle.transmission`

The migration is `20261111000000_driver_go`.

## API

All driver endpoints require `PROVIDER`/`BOTH` and check
`providerType === DRIVER`.

```
GET    /api/v1/driver-go/me
PATCH  /api/v1/driver-go/online
GET    /api/v1/driver-go/availability
PUT    /api/v1/driver-go/availability
GET    /api/v1/driver-go/jobs
GET    /api/v1/driver-go/jobs/:id
POST   /api/v1/driver-go/jobs/:id/accept
POST   /api/v1/driver-go/jobs/:id/decline
PATCH  /api/v1/driver-go/jobs/:id/status
POST   /api/v1/driver-go/jobs/:id/verify-start-otp
GET    /api/v1/driver-go/earnings
```

State machine:

```
REQUESTED → CONFIRMED → DRIVER_EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED
                 ↘ CANCELLED          ↘ CANCELLED         ↘ DISPUTED
```

Start OTP is a 4-digit code generated when the customer booking is created
(next phase). It is HMAC-hashed with `OTP_HASH_SECRET`; the driver enters it
after arriving, which moves the job to `IN_PROGRESS`.

## Driver app

The provider tab layout switches to a driver branch when
`providerProfile.providerType === 'DRIVER'`:

- **Dashboard** — online toggle, verification, stats, next job, manage links
- **Jobs** — new requests, active, history
- **Earnings** — today/week/month + completed trips
- **Messages** — existing chat inbox
- **Profile** — driver profile, rates, availability, earnings, support, sign out

Root stack screens:

- `/driver-booking/[id]` — job details, accept/decline, en route, arrived,
  start OTP, complete
- `/driver-availability` — weekly windows and save

`(app)/index.tsx` and `(app)/profile.tsx` return the driver components for a
driver account. Customer and dealer layouts are unchanged; driver routes are
hidden from them.

## Seeded pilot driver

```
email:    driver1@weyro.dev
password: TestPass123!
code:     1234   (for the seeded requested/confirmed jobs)
```

Run:

```bash
cd packages/database
# with apps/api/.env loaded:
npx ts-node prisma/seed-driver-go.ts
```

The seed upserts a verified driver, weekly availability and three jobs against
the existing test customer: one `REQUESTED`, one `CONFIRMED`, one `COMPLETED`.
It is safe to rerun.

## Verification done

- Driver login shows driver tabs, dashboard, stats, next job.
- Jobs screen groups new/active/history.
- Accept → en route → arrived → OTP `1234` → in progress → completed.
- Earnings reflect the completed trip and 18% platform fee.
- Availability loads seeded windows and saves.
- Driver profile shows rates, licence, experience, stats.
- API unit tests: state machine + OTP (181 total API tests).
- Mobile tsc/eslint/Jest green.

## Not in this phase

- Customer Driver Go booking flow and driver selection/pricing quote
- Razorpay order/refund/release for driver bookings
- Reviews and driver ratings updates
- Customer ↔ driver chat thread linked to a driver booking
- Driver foreground location reporting and customer live tracking
- Background location
- On-demand matching/dispatch engine
- Admin UI for creating drivers (seed script only)
- KYC/licence API verification (manual pilot verification)
- Cancellation/refund policy UI and driver cancellation
- Payout ledger/Razorpay Route

These are the next slices; the schema and interfaces are shaped so they can be
added without changing the existing service/dealer flows.
