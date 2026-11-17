# Weyro — notes for coding agents

See `AGENTS.md` for the Expo rules (check the SDK docs before touching Expo APIs).

## Setup gotchas (each of these cost real time once)
- The API consumes `@weyro/database`, `@weyro/validation` and `@weyro/api-contracts` from their
  built `dist/`. After editing `packages/*`, run `npm run build:packages` or the API will
  silently use stale code.
- After changing `packages/database/prisma/schema.prisma`: `npm run db:generate`, then rebuild packages.
- Migrations: `prisma migrate dev` is interactive and won't run in an agent shell. Generate SQL
  with `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script`
  and hand-trim it: Prisma wants to DROP the PostGIS `*_gix` GiST indexes because it can't model
  them. Never include those drops. Hand-written partial indexes live only in SQL.
- E2E tests need a Postgres + PostGIS database with migrations applied (`npm run test:e2e -w @weyro/api`).
  Use a scratch database, never a developer's real one.
- `/auth/register` is throttled per IP; e2e helpers register through `AuthService` for that reason.

## Checks before committing
`npm run lint`, `npm run typecheck`, `npm test -w @weyro/api`, `npx tsc --noEmit` in `apps/mobile`,
`npx jest` in `apps/mobile`, and the e2e suite for anything touching auth, payments or bookings.

## Working in long sessions
- Filter noisy command output (`| tail`, `| grep -E "Tests:|✕|error"`) and read file line ranges
  instead of whole files. Look at the raw output for anything important or surprising.
- A filter that only matches "success" hides failures: match both.
- Mobile native folders (`apps/mobile/ios`, `android`) are generated (`expo prebuild`); configure
  native settings in `app.json`, never by editing them.
