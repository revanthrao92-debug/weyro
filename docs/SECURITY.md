# Weyro Security & Compliance Specification

## 1. Authentication & Credentials Security

- **Password Storage**: User passwords are encrypted using `bcrypt` with a cost factor of 12 (`rounds = 12`).
- **Timing Attack Mitigation**: When login requests target an unverified or non-existent email/phone, the authentication service executes a constant-time dummy bcrypt comparison against a pre-computed hash. This ensures indistinguishable response latency and prevents account enumeration attacks.
- **Input Validation**: All incoming auth payloads are strictly validated using Zod schemas (`.strict()`) to prevent prototype pollution or parameter injection.

---

## 2. Token Lifecycle & Stateful Refresh Rotation

- **Dual-Token Architecture**:
  - `AccessToken`: Short-lived (15 minutes) cryptographically signed JWT containing minimal user claims (`sub`, `email`, `role`, profile IDs).
  - `RefreshToken`: Cryptographically random 64-character token stored exclusively as a SHA-256 hash in the `refresh_tokens` database table.
- **Rotation on Use**: Every refresh operation (`POST /api/v1/auth/refresh-token`) atomically revokes the presented refresh token and issues a brand-new token pair. If a revoked token is reused, all tokens belonging to the user are invalidated immediately as a breach countermeasure.
- **Client Storage**: Tokens are stored using hardware-backed keystores via `expo-secure-store` on iOS and Android. Unencrypted `AsyncStorage` is never used for authentication credentials.

---

## 3. Role-Based Access Control & PII Masking

- **Global Route Protection**: All endpoints require a valid JWT by default via global `JwtAuthGuard`, unless decorated with `@Public()`.
- **Role Enforcement**: `RolesGuard` strictly validates user privileges (`CUSTOMER`, `PROVIDER`, `ADMIN`).
- **Customer PII Protection**: Prior to quotation acceptance, customer addresses and contact numbers are masked (e.g. `Koramangala, Bengaluru...`). Only when a customer explicitly accepts a provider's bid are contact details unmasked for fitment and courier logistics.

---

## 4. Object Storage & Upload Security

- **No Server Disk Writes**: Local filesystem writes and static Express asset directories (`/uploads`) are eliminated.
- **Presigned PUT Authorization**: Mobile devices upload directly to S3-compatible object storage via short-lived (5-minute) presigned PUT URLs.
- **Strict Content-Type Validation**: Presigned URLs are only generated for validated image MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/heic`).
- **Rate Limiting**: Presigned URL requests are throttled to a maximum of 20 requests per minute per IP.

---

## 5. Payment Security & Webhook Idempotency

- **Cryptographic Signature Verification**:
  - Razorpay payment signatures are validated using timing-safe HMAC SHA-256 comparison: `crypto.timingSafeEqual()`.
  - Razorpay webhook payloads are authenticated against `RAZORPAY_WEBHOOK_SECRET` before processing.
- **Webhook Idempotency**:
  - All verified webhooks are tracked in the `webhook_events` table using the unique `eventId`.
  - Duplicate webhook deliveries are detected instantly and ignored without duplicate processing.
- **Production Guardrails**:
  - The `MockPaymentGateway` is strictly forbidden from booting in `NODE_ENV === 'production'`.

---

## 6. Regulatory Compliance (RBI PA/PG Guidelines)

- **Application Escrow Semantics**: Weyro's internal payment statuses (`PENDING`, `AUTHORIZED`, `CAPTURED`) represent milestone authorizations within the application workflow.
- **Reserve Bank of India (RBI) Guidelines**: Under RBI Guidelines on Regulation of Payment Aggregators and Payment Gateways (RBI/DPSS/2019-20/174):
  - No marketplace platform can hold customer or merchant funds in general corporate accounts without a PA license or an approved Nodal/Escrow account arrangement with a scheduled commercial bank.
  - Automated marketplace split disbursements and vendor payouts must operate through an authorized Payment Aggregator's marketplace infrastructure (e.g., Razorpay Route) with KYC-verified partner accounts.
