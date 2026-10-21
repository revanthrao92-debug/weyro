# Weyro 🚗🔧

> **Automotive marketplace connecting vehicle owners with workshops, garages, and spare-parts distributors in India.**

---

## 📌 Architecture & Overview

Wyro operates as an automotive marketplace for the Indian landscape—handling vehicle breakdowns, damaged components, and spare part sourcing across INR (₹) pricing, UPI/card payments via Razorpay, +91 mobile authentication, and Indian vehicle makes (Maruti Suzuki, Hyundai, Tata, Mahindra, Honda, Toyota).

```mermaid
graph TD
    subgraph Client ["Mobile Client (Expo SDK 57 / React Native)"]
        UI["UI Screens (Quotes, Post, Explore, Admin)"]
        Store["State & Hooks (authStore, damageRequestStore)"]
        Secure["Token Storage (expo-secure-store)"]
        Queue["Offline Mutation Queue (Idempotency + Backoff)"]
        ClientAPI["Typed API Client (Auto-Refresh on 401)"]
    end

    subgraph Backend ["Backend API (NestJS 11 / Express)"]
        GW["Global Guards (JWT, Roles, Throttler)"]
        Modules["Modules: Auth, Requests, Quotes, Payments, Uploads, Chat, Health"]
        SM["Domain State Machines (Request, Quote, Booking, Payment)"]
        Cron["Task Expiry Cron Service"]
    end

    subgraph Data ["Data Layer & External Services"]
        PG[("PostgreSQL 16 + PostGIS (Spatial GiST Index)")]
        S3[("S3-Compatible Storage (Presigned PUT URLs)")]
        RZP["Razorpay Gateway (UPI, Cards, Webhooks)"]
        ExpoPush["Expo Push Service (Chunked Mobile Dispatch)"]
    end

    UI --> Store
    Store --> ClientAPI
    Store --> Queue
    Queue --> ClientAPI
    ClientAPI --> Secure
    ClientAPI -->|HTTPS / WSS| GW
    GW --> Modules
    Modules --> SM
    Modules --> PG
    Modules --> S3
    Modules --> RZP
    Modules --> ExpoPush
    Cron --> PG
```

---

## 🚧 Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication (JWT + refresh rotation) | ✅ Implemented | bcrypt hashing, constant-time lookup |
| Role-based access control (CUSTOMER/PROVIDER/BOTH/ADMIN) | ✅ Implemented | Global guards, `@Roles()` decorator |
| Damage request broadcast | ✅ Implemented | Nationwide when no location; ST_DWithin radius when coords provided |
| Quotation submission & acceptance | ✅ Implemented | State machine guarded, idempotent acceptance |
| Booking milestone tracking | ✅ Implemented | CONFIRMED → COMPLETED transitions |
| Customer reviews & ratings | ✅ Implemented | 5-star with provider avg rating recomputation |
| Razorpay payment orders & verification | ✅ Implemented | Mock gateway in dev; Razorpay gateway with HMAC |
| Payment webhook idempotency | ✅ Implemented | Duplicate event detection, HMAC verification |
| Real-time chat (Socket.IO + rooms) | ✅ Implemented | JWT auth on connect, room authorization |
| Push notifications (Expo) | ✅ Implemented | Invalid token pruning, in-app notification records |
| Presigned URL uploads (S3-compatible) | ✅ Implemented | MIME validation, 5-minute URL expiry |
| EXIF/GPS stripping on uploads | ✅ Implemented | `sharp`-based server-side stripping |
| Max file size enforcement (10 MB) | ✅ Implemented | API validation + client-side check |
| Provider verification workflow | ✅ Implemented | PENDING → VERIFIED/REJECTED via admin console |
| Escrow payment disbursement | 🟡 Partial | Payment status machine (PENDING/AUTHORIZED/CAPTURED/REFUNDED); actual fund disbursement via Razorpay Route is **planned** |
| RBI PA/PG compliance | 🟡 Partial | Internal milestone states only; full compliance **planned** |
| GSTIN / trade license verification | 🟡 Planned | Provider documents field exists; validation logic **planned** |

---

## ⚡ Quickstart (≤ 5 Commands)

To bring up the entire Weyro stack locally:

```bash
# 1. Install all dependencies across monorepo workspaces
npm install

# 2. Copy environment configuration
cp .env.example .env && cp apps/api/.env.example apps/api/.env

# 3. Boot PostgreSQL with PostGIS
docker-compose up -d

# 4. Build shared packages and run database baseline migration
npm run build:packages && npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

# 5. Start API & Mobile client concurrently
npm run build && (cd apps/api && npm run start:dev &) && npx expo start
```

---

## 🇮🇳 India Market Localization

- **Currency & Denominations**: Indian Rupee (INR / ₹) calculations across all quotes, bookings, and payments. Razorpay order amounts calculated in paise.
- **Payment Infrastructure**: Razorpay gateway integration supporting UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking, Credit/Debit cards, and marketplace webhook idempotency.
- **Identity & Verification**: +91 E.164 phone number authentication, constant-time dummy password verification preventing timing attacks.

---

## ⚙️ Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string with PostGIS | **Yes** | `postgresql://postgres:postgres@localhost:5432/weyro?schema=public` |
| `PORT` | NestJS API listening port | No | `4000` |
| `JWT_ACCESS_SECRET` | Secret key for signing short-lived JWT access tokens | **Yes** | `dev_access_secret_min_32_chars_long!!` |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | No | `15m` |
| `JWT_REFRESH_SECRET` | Secret key for rotating stateful refresh tokens | **Yes** | `dev_refresh_secret_min_32_chars_long!!` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | No | `30d` |
| `CORS_ORIGINS` | Comma-separated CORS allowed origins | No | `*` |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID for INR payments | No | `rzp_test_placeholder` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret for order creation | No | `placeholder_secret` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret for HMAC SHA256 webhook verification | No | `placeholder_webhook_secret` |
| `STORAGE_DRIVER` | Storage driver (`s3` or `local` for test) | No | `local` |
| `STORAGE_BUCKET` | S3 / MinIO object storage bucket name | No | `weyro-media` |
| `EXPO_PUBLIC_API_URL` | API base URL for mobile Expo client | No | `http://localhost:4000/api/v1` |

---

## 🛠️ Verification & Testing

```bash
# Typecheck entire monorepo (strict mode)
npm run typecheck:all

# Run ESLint across codebases
npm run lint

# Run API tests
npm run test

# Run Expo Doctor SDK conformance check
npx expo-doctor
```

Interactive OpenAPI documentation is available at `http://localhost:4000/api/docs`.

---

## 📁 Repository Layout

```
weyro/
├── app.json                      # Expo app configuration
├── package.json                  # Root workspace config
├── .env.example                  # Environment variable template
├── docker-compose.yml            # Local PostgreSQL + PostGIS
├── src/                          # Mobile app (Expo Router)
│   ├── app/                      # Expo Router screens
│   ├── components/               # Shared UI components
│   ├── services/                 # API client, auth store, offline queue
│   └── constants/theme.ts        # Design tokens
├── apps/
│   └── api/                      # NestJS backend API
├── packages/
│   ├── api-contracts/            # Shared TypeScript types
│   ├── database/                 # Prisma schema + geo queries
│   └── validation/               # Zod validation schemas
├── .github/
│   └── workflows/
│       └── ci.yml                # CI/CD pipeline
└── graphify-out/                 # Code knowledge graph (auto-generated)
```

---

## 📱 Mobile UI

The mobile app uses Expo SDK 57 with Expo Router. Screens:
- `/` — Post Damage Request (photo upload, vehicle details, broadcast)
- `/quotes` — Quotes & Bookings (accept quotes, milestone tracking, reviews)
- `/explore` — Provider Feed (browse requests, submit quotes)
- `/chat` — Real-time chat between customer and provider
- `/auth` — Login / Register with role selection
- `/admin` — Operations console (provider verification, escrow ledger)
