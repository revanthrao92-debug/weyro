# Weyro — road to production

Written 2026-11-20. Plain-language status and the ordered steps to a safe launch.
Details live in `AUDIT.md` (findings and fixes), `DEPLOY_RAILWAY.md` (deploy steps),
`PHASE1_BACKLOG.md` (external blockers).

## Where we are

- **Code:** the four-phase audit fix (PR #8, `audit-fix-pass` → `main`) and the follow-up work
  (PR #9, `cleanup-dead-code` → `audit-fix-pass`) are on GitHub with green CI. **Nothing is merged.**
  Merging to `main` deploys to Railway and runs the pending migrations.
- **Production** runs an older commit: 5 of 14 migrations applied (OpenCode's check, 2026-11-18).
- **Core marketplace flow works end to end in a browser** (2026-11-20 walk-through on Expo web, local
  API, throwaway database): customer posts a request → garage quotes → customer accepts → booking →
  chat → garage starts the job. Tow requests and the parts shop were walked the same way.
  Bugs found on the way were fixed in PR #9 (see its commits from 2026-11-20).
- **Never tested on a real phone.** Push, background location, camera uploads and push-tap routing
  need a device build.

## 1. Launch blockers (in this order)

| # | What | Who | Why it blocks |
|---|------|-----|---------------|
| 1 | **Decide how customers pay** — Razorpay checkout in the app, "paid in cash" recorded by the provider, or both | You | A booking cannot be marked completed until its payment is captured, and no screen takes payment. Today providers cannot complete jobs. |
| 2 | **SMS provider** — MSG91 (start DLT registration now, takes days to weeks) or Twilio | You | Registration and password reset need an OTP. Production refuses to start without a real provider. |
| 3 | **Private uploads bucket** + least-privilege keys (`PHASE1_BACKLOG.md` §1) | You | Damage photos and KYC documents must not be publicly readable. |
| 4 | **Build item 1** (payment screen and/or cash option) | Code | Follows your decision. |
| 5 | **Staging**: Supabase project in Mumbai + Railway `staging` environment | You (≈30 min), then code | First place the pending migrations, Razorpay test mode, OTP and uploads run against real services. |
| 6 | **Device builds** (`eas build --profile staging`), one iPhone and one Android | You + code | Verify push, push-tap routing, background location for tow/roadside, photo upload, error screens. |
| 7 | **Merge PR #9 → PR #8 → `main`** with the prerequisites below | You | Deploys everything. |

**Before merging to `main`** (from `DEPLOY_RAILWAY.md` and the audit):
- Run the duplicate-active-bookings check in production; the H6 migration refuses to run if any exist.
- Set `TRUST_PROXY=1`, the `MSG91_*` (or Twilio) variables, production Razorpay keys and an
  independent `RAZORPAY_WEBHOOK_SECRET`.
- Existing password users must do one OTP login after the release (`phoneVerified=false`).
- Watch the first deploy's migration log; 9 migrations run in one go.

## 2. Soon after launch

- **Live tracking for customers.** Tow/roadside providers send their location, but the app has no
  socket client and no screen reads `/bookings/:id/tracking`; customers see a placeholder card.
- **Confirm before accepting a quote.** Accepting is one tap and creates a booking (and, once
  payments exist, a charge).
- **Chat over the existing socket gateway** instead of the 5-second polling added on 2026-11-20.
- **Backfill `completedJobs`** from completed bookings (the counter only started counting garage
  bookings on 2026-11-20). One SQL update; needs your go-ahead because it changes public numbers.
- **API region.** API in Railway Singapore, database in Supabase Mumbai: about 60 ms per query.
  Moving the API to Mumbai (AWS/GCP) is the largest speed gain available.
- **Image processing off the request path** (`sharp` currently runs inside the upload request).
- **Sentry source maps** (needs `SENTRY_AUTH_TOKEN` in EAS).

## 3. Housekeeping (no user impact)

- `npm audit`: 3 high findings in the Prisma CLI's config loader (build time only); fixed only by
  Prisma 7, a major upgrade.
- `AppModule` builds its rate-limit storage once at import; `forRootAsync` would make it testable
  without overrides.
- `apps/mobile/src/app/(app)/service-selection.tsx` is not declared in the tabs layout and nothing
  links to it — likely dead.
- On web the session is not kept across reloads (`expo-secure-store` is native-only). Fine while
  the app ships only to phones.

## Decisions waiting on you

1. Payments: Razorpay, cash, or both (blocks launch).
2. SMS provider: MSG91 or Twilio.
3. Whether accepting a quote should ask for confirmation.
4. Whether to backfill `completedJobs`.
5. When to set up staging.
6. What happens to a request when its booking is cancelled: reopen it for new quotes, or close it.
   Today it stays ACCEPTED forever (the request state machine has no exit from ACCEPTED).
