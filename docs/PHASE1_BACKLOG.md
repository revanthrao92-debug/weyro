# Phase 1 — remaining backlog (8%)

Phase 1 (Security & API Foundations) is **92% complete** as of 2026-11-10.
Everything code-level is implemented and verified. The remaining items are
external configuration plus one low-priority cleanup. Do these at deployment
time — not now.

## 1. Private uploads bucket (BLOCKED — external)
Code is ready: `S3StorageService` validates magic bytes and returns presigned
GET URLs when `STORAGE_PUBLIC_URL` is **not** set.

Still required in the S3 console:
- Bucket policy: **private** (no public read).
- Bucket CORS: allow `PUT` from the app origin(s).
- IAM user limited to `s3:PutObject` / `s3:GetObject` on `weyro-uploads/*`.
- Leave `STORAGE_PUBLIC_URL` empty in production.
- Verify: upload a photo, confirm the finalize response is a signed URL and
  the object is not reachable without it.

## 2. Real SMS provider for OTP (BLOCKED — external)
`apps/api/src/modules/auth/sms.gateway.ts` still throws for `msg91` / `twilio`.
Env validation refuses to boot in production with `SMS_PROVIDER=console`, so
this must be wired before production auth works.

Required:
- MSG91 or Twilio account + credentials (`SMS_MSG91_*` or `SMS_TWILIO_*`).
- Implement the real HTTP `send()` in the selected gateway (one file).
- Test: send-otp → verify-otp → login, and reset-password via OTP.

## 3. Staging profile (LOW)
`NODE_ENV` is `development | production | test`. Add `staging` only if a
separate staging deployment is created; mirror production validation rules.

## Optional hardening (not required for Phase 1 completion)
- Validate Razorpay webhook event shape after signature verification
  (currently trust is derived from the signature + idempotency).
- Remove `JWT_REFRESH_SECRET` from required env or use it if refresh tokens
  ever become JWTs (today they are opaque, SHA-256 hashed in the DB).

## Do not regress
- `pino` serializers must never log headers (see
  `src/common/logger/http-serializers.ts`).
- Uploads must reject non-image bytes (magic-byte check) and never store the
  original buffer when sharp fails.
- JWT verification must stay pinned to `HS256` and require `sub` + `role`.
- Route ids must keep the `idParamSchema` pipe.

## Verification commands
```bash
cd apps/api
npx tsc --noEmit
npx eslint src --max-warnings 0
npx jest --silent
DATABASE_URL=... DIRECT_URL=... npx jest --config jest-e2e.config.js --runInBand
```
Expected at 92%: tsc 0, lint 0, unit 176/176, e2e 39/39.
