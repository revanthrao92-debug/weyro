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

The API replicas run in **Singapore** (`asia-southeast1`), the closest Railway
region to India. **The database must live in the same region.** Moving only the
API adds a cross-region round trip to every query, which is slower than staying
put. When you move the API, also:

1. Create the Postgres (and Redis) instance in the Singapore region.
2. Restore the data (`pg_dump` / `pg_restore`) during a maintenance window.
3. Point `DATABASE_URL`, `DIRECT_URL` and `REDIS_URL` at the new instances.
4. Run `npm run db:migrate:deploy` against the new database.

## Payments

- Turn **auto-capture ON** in the Razorpay dashboard (Settings → Payment
  Capture). The API only treats a payment as paid once it is `captured`; if a
  payment arrives as `authorized` the API captures it itself with the expected
  amount, but auto-capture avoids the extra round trip and the 5-day
  authorization expiry.
- Configure the webhook for `payment.captured`, `payment.failed`,
  `refund.processed` and `refund.failed`.
