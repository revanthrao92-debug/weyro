# Weyro 🚗🔧

> **Production-ready automotive marketplace connecting Indian vehicle owners with verified workshops, garages, and spare-parts distributors nationwide.**

---

## 📌 Architecture & Overview

Weyro operates as an automotive marketplace tailored for the Indian landscape—handling vehicle breakdowns, damaged components, and spare part sourcing across INR (₹) pricing, UPI/card payments via Razorpay, +91 mobile authentication, and Indian vehicle makes (Maruti Suzuki, Hyundai, Tata, Mahindra, Honda, Toyota).

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

## ⚡ Quickstart (≤ 5 Commands)

To bring up the entire Weyro stack locally:

```bash
# 1. Install all dependencies across monorepo workspaces
npm install

# 2. Copy environment configuration
cp .env.example .env && cp apps/api/.env.example apps/api/.env

# 3. Boot PostgreSQL with PostGIS extension
docker-compose up -d

# 4. Build shared packages and run database baseline migration
npm run build:packages && npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

# 5. Start API & Mobile client concurrently
npm run build && (cd apps/api && npm run start:dev &) && npx expo start
```

---

## 🇮🇳 India Market Localization

- **Currency & Denominations**: Strict Indian Rupee (INR / ₹) calculations across all quotes, bookings, and payments. Razorpay order amounts calculated in paise.
- **Payment Infrastructure**: Razorpay gateway integration supporting UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking, Credit/Debit cards, and marketplace webhook idempotency.
- **Regulatory Compliance (RBI PA/PG)**: Fully adheres to RBI Guidelines on Regulation of Payment Aggregators (RBI/DPSS/2019-20/174). Escrow records represent internal milestone states; funds disbursements are gated through authorized banking partners / Razorpay Route.
- **Identity & Verification**: +91 E.164 phone number authentication, constant-time dummy password verification preventing timing attacks, and GSTIN / trade license verification for automotive service partners.

---

## ⚙️ Environment Variables

| Variable | Description | Required | Default |
|---|---|---|---|
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
| `STORAGE_DRIVER` | Storage driver (`s3` or `memory` for test) | No | `memory` |
| `STORAGE_BUCKET` | S3 / MinIO object storage bucket name | No | `weyro-media` |
| `EXPO_PUBLIC_API_URL` | API base URL for mobile Expo client | No | `http://localhost:4000/api/v1` |

---

## 🛠️ Verification & Testing

```bash
# Typecheck entire monorepo (strict mode)
npm run typecheck:all

# Run ESLint across codebases
npm run lint

# Run Jest unit and integration suites (60+ tests)
npm run test -w @weyro/api

# Run Expo Doctor SDK conformance check
npx expo-doctor
```

Interactive OpenAPI documentation is available at `http://localhost:4000/api/docs`.
