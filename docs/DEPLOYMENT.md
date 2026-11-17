# Deployment notes

Step-by-step Railway setup lives in [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md).
This page collects the settings that are easy to get wrong.

## Reverse proxy: `TRUST_PROXY` (required)

`TRUST_PROXY` **must be set in production — the API refuses to boot without it.**

Railway terminates TLS in front of the API, so Express only sees the proxy's
socket address. Without trusting the proxy, every user shares one rate-limit
bucket; trusting too much lets clients forge `X-Forwarded-For` and dodge the
per-IP throttles.

```env
TRUST_PROXY=1
```

- `1` = trust exactly one hop (Railway's edge proxy). Use `2` only if you add a
  second proxy/CDN (e.g. Cloudflare) in front of Railway.
- An IP/CIDR list is also accepted.
- `true` (trust every hop) is rejected in production.

## Region

The database (Supabase) is in **Mumbai**. Railway has no India region; its closest is
**Singapore** (`asia-southeast1-eqsg3a` in `.railway/railway.ts`), so the API runs there.

- Singapore → Mumbai is roughly 60 ms per database round trip, versus roughly 250 ms+
  from the US West region the API used before. Every request makes several queries, so
  this matters more than the distance to users.
- **Do not move the database to Singapore**: Mumbai keeps user data in India.
- Best long-term option: run the API in Mumbai too (e.g. AWS `ap-south-1` or Google
  Cloud `asia-south1`), next to the database. Queries then take a few milliseconds.
- Keep Redis next to the API (Singapore on Railway).

## Payments

- Turn **auto-capture ON** in the Razorpay dashboard (Settings → Payment
  Capture). The API only treats a payment as paid once it is `captured`; if a
  payment arrives as `authorized` the API captures it itself with the expected
  amount, but auto-capture avoids the extra round trip and the 5-day
  authorization expiry.
- Configure the webhook for `payment.captured`, `payment.failed`,
  `refund.processed` and `refund.failed`.

## Error monitoring (Sentry)

Both apps report errors to Sentry **only when a DSN is configured**; without one
nothing is initialised and nothing is sent.

| App | Variable | Notes |
| --- | --- | --- |
| API | `SENTRY_DSN` (+ optional `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`) | Read in `apps/api/src/instrument.ts`, which must stay the first import of `main.ts`. 5xx and unhandled errors are reported; 4xx are not. |
| Mobile | `EXPO_PUBLIC_SENTRY_DSN` (+ optional `EXPO_PUBLIC_SENTRY_ENVIRONMENT`) | Set as an EAS environment variable. |

**Privacy.** Phone numbers, OTP codes, passwords and tokens are scrubbed from every
event and breadcrumb (`packages/api-contracts/src/sentry-scrub.ts`, covered by
tests that run the real SDK). The SDKs' own collection of headers, cookies, request
bodies, query strings, DB query parameters and local variables is switched off.

**Not done yet: source maps.** Mobile stack traces are not symbolicated until
source maps are uploaded. That needs the `@sentry/react-native` config plugin plus a
`SENTRY_AUTH_TOKEN` in EAS (see Expo's "Using Sentry" guide). It was left out
deliberately because the plugin can fail a build that has no token.

## Production image

`apps/api/Dockerfile` installs only the API's production dependencies in the runner
stage (`npm ci --omit=dev -w @weyro/api --include-workspace-root`) plus the generated
Prisma clients. Mobile, Expo, test and build tooling are not in the image.

`prisma` is a **production** dependency of `@weyro/database` on purpose: the Railway
pre-deploy step (`npm run db:migrate:deploy`) runs `prisma migrate deploy` inside
this image.

## Background location (providers)

Providers can share live location for an active job while the app is in the
background (Android foreground service, iOS `location` background mode). The
permission strings live in `apps/mobile/app.json` (expo-location plugin).

- Background permission is requested **only** from the provider job screen, never
  from customer flows (enforced by `__tests__/background-location-scope.spec.ts`).
- Tracking stops when the job ends, when the provider signs out, and when the
  server reports the job is over.
- Apple and Google review background location: describe it as "providers share their
  live position with the customer during an active job" in the store listings.
- Limitation: if the access token expires while the app is not mounted, updates
  resume the next time the app is opened.
