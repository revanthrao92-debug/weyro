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

**Source maps (readable crash reports).** The `@sentry/react-native` config plugin
(`app.json`) and `getSentryExpoConfig` (`metro.config.js`) are on. They need three
EAS environment variables for the `preview` and `production` environments:
`SENTRY_ORG`, `SENTRY_PROJECT` (plain) and `SENTRY_AUTH_TOKEN` (secret).
**A preview/production build without the token fails on purpose.** That way a build
that would send unreadable crash reports can't ship. `development` builds skip the
upload (`SENTRY_DISABLE_AUTO_UPLOAD` in `eas.json`). Every mobile event is tagged
with `expo-update-id`, `expo-channel` and `expo-runtime-version`
(`apps/mobile/src/lib/sentry.ts`), so a crash points to the exact update to undo.

## App updates (over the air)

The app downloads new JavaScript (screens, text, logic) on open and uses it on the next
open, with no store review. Native changes still need a store build.

**Channels.** Each build profile in `eas.json` listens to one channel:
`preview` (internal builds on the team's and a few trusted partners' phones, the
**test group**), `production` (store builds, everyone) and `staging`.
`runtimeVersion` uses the `fingerprint` policy, so an update only reaches builds with
the same native code. An update that needs a native change can't reach an old build.
Builds made before `expo-updates` was added never receive updates. Make a new
preview and production build once.

**Over the air or store release?**

| Change | How |
| --- | --- |
| Text, layout, screen logic, bug fix in JS | Over the air |
| New permission, new native library, Expo SDK upgrade, app icon or splash | Store build |
| Anything in payments or money logic | Store build, with full testing, never over the air |

**Publishing.** Only through GitHub Actions: **Publish app update** (`.github/workflows/publish-update.yml`).
It refuses to publish unless all of these hold:
- CI passed for that exact commit.
- The mobile checks pass again.
- The built bundle contains the right API address for the channel.
- For production:
  - it runs from `main`;
  - the `production` GitHub environment has a required reviewer, who must approve;
  - the bundle has a Sentry DSN;
  - source maps upload.

Repository setup:
- Secret `EXPO_TOKEN`
- Secret `SENTRY_AUTH_TOKEN`
- Variables `SENTRY_ORG` and `SENTRY_PROJECT`
- Environment `production` with a required reviewer
- EAS env `EXPO_PUBLIC_SENTRY_DSN` for `preview` and `production`

**Routine, one fix per update:**
1. Publish to `preview`. Use the app on a test phone for a day; reopen it twice to load the update.
2. Publish to `production` at **10%**. Watch Sentry (filter by `expo-update-id`) for an hour.
3. Raise to 50%, then 100%: `eas update:edit` (choose the update, enter the new percentage).
4. No publishing on Friday evenings or the night before a festival rush.

**Undo:**

| Situation | Command |
| --- | --- |
| Problem during a rollout | `eas update:revert-update-rollout` |
| Problem after 100% | `eas update:rollback` (back to the previous update) or `eas update:roll-back-to-embedded --channel production` (back to the store build's code) |

Phones pick up the undo the next time the app opens. **Undo fixes the app, not data**:
anything a bad update already wrote to the server has to be fixed separately.
Practise an undo on `preview` once a quarter.

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
