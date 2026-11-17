# Deploying the Weyro API on Railway

## Architecture

| Component | Provider |
|---|---|
| API | Railway (Dockerfile `apps/api/Dockerfile`) |
| Redis | Railway Redis service |
| PostgreSQL + PostGIS | **Keep Supabase** |
| Media storage | Cloudflare R2 or AWS S3 (private bucket) |
| Mobile app | EAS / development build |

Railway Postgres does not reliably include PostGIS, and this API uses `ST_DWithin`/`geography`. Keep the existing Supabase database.

## Railway service

1. Create a project and add the repo as a service.
2. Railway reads `railway.json`; confirm:
   - builder: Dockerfile
   - Dockerfile: `apps/api/Dockerfile`
   - pre-deploy: `npm run db:migrate:deploy`
   - healthcheck: `/api/v1/ready`
3. Add a Redis service and copy its `REDIS_URL` into the API service.
4. Give the API at least 1 GB RAM (2 GB if photo uploads are heavy).

## Required environment

```env
NODE_ENV=production
PORT=4000
TRUST_PROXY=1

DATABASE_URL=<Supabase pooled connection string>
DIRECT_URL=<Supabase direct connection string>
DATABASE_POOL_MAX=10
DATABASE_POOL_TIMEOUT=10

JWT_ACCESS_SECRET=<random 48+ chars>
JWT_REFRESH_SECRET=<different random 48+ chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGINS=https://your-web-domain

REDIS_URL=<Railway Redis URL>

STORAGE_DRIVER=s3
STORAGE_BUCKET=<private bucket>
STORAGE_REGION=auto
STORAGE_ENDPOINT=<R2 endpoint when using R2>
STORAGE_ACCESS_KEY=<key>
STORAGE_SECRET_KEY=<secret>
# Never set STORAGE_PUBLIC_URL in production

PAYMENT_GATEWAY=razorpay
RAZORPAY_KEY_ID=<key>
RAZORPAY_KEY_SECRET=<secret>
RAZORPAY_WEBHOOK_SECRET=<independent webhook secret>

OTP_HASH_SECRET=<random 32+ chars>
OTP_DEBUG_ECHO=false
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=<key>
MSG91_OTP_TEMPLATE_ID=<DLT template id>
MSG91_SENDER_ID=<id>
```

Do **not** set `ALLOW_DEMO_SEED` in production.

If Supabase's pooler is in transaction mode, use the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL`. Keep `DATABASE_POOL_MAX` small (5–10) per API replica.

## After deploy

1. Set the Razorpay webhook to `https://<railway-domain>/api/v1/payments/webhook`.
2. Confirm the bucket is private.
3. Do not expose Postgres or Redis publicly.
4. Run one API replica at first. Add replicas only after confirming `REDIS_URL` is connected.
5. Verify `GET /api/v1/ready` returns 200 and the login smoke test passes.

## Staging

Test schema, auth and payment changes on staging before merging to `main` (merging deploys to production and runs migrations on the production database).

1. **Database:** a separate Supabase project in Mumbai with PostGIS enabled. Never point staging at the production database. Run `npm run db:migrate:deploy` against it; the demo seed (`ALLOW_DEMO_SEED=true`) is allowed here only.
2. **Railway:** add a `staging` environment to the project with its own Redis. Set the API service source to the branch under test so nothing needs merging.
3. **Variables:** never copy production secrets. Use new `JWT_*` secrets and `OTP_HASH_SECRET`, `TRUST_PROXY=1`, staging `DATABASE_URL`/`DIRECT_URL`, Razorpay **test** keys and a test webhook secret, and a separate private bucket.
4. **SMS:** `NODE_ENV=production` refuses the console SMS driver. Until a real provider is set up, run staging with `NODE_ENV=development` and `OTP_DEBUG_ECHO=true`, then do one production-mode boot check before merging.
5. **Mobile:** `eas build --profile staging` builds against `https://weyro-api-staging.up.railway.app/api/v1`; update that URL in `apps/mobile/eas.json` if Railway assigns a different domain. The `preview` profile points at **production**, so don't test with it.

Before merging to production, check for duplicate active bookings (the one-active-booking migration refuses to run if any exist):

```sql
SELECT q."requestId", count(*) FROM bookings b
JOIN quotations q ON q.id = b."quotationId"
WHERE b.status <> 'CANCELLED' GROUP BY 1 HAVING count(*) > 1;
```

## Scaling

- API is stateless (JWT), so replicas are safe once Redis is connected.
- Total database connections = replicas × `DATABASE_POOL_MAX`.
- Per-user rate limits and the shared OTP throttle use Redis when configured.
