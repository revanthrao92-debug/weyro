# Architecture Decision Records (ADRs)

This document tracks significant technical, architectural, and compliance decisions made across the Weyro codebase.

---

## ADR 001: Monorepo Structure & NPM Workspaces
- **Date**: 2026-10-19
- **Status**: Accepted
- **Context**: The repo contained separate packages (`packages/api-contracts`, `packages/database`, `packages/validation`) and apps (`apps/api`), but lacked root npm workspaces. It relied on TypeScript path mapping hacks (`@weyro/api-contracts` pointing directly to `.ts` files), causing runtime resolution errors when compiled JavaScript was executed (`node apps/api/dist/main.js`). Root dependencies also contained database dependencies (`@prisma/client`) bundled into the mobile app scope.
- **Decision**: 
  - Standardize on npm workspaces with `"workspaces": ["apps/*", "packages/*"]`.
  - Compile `@weyro/api-contracts`, `@weyro/validation`, and `@weyro/database` into real packages with `exports` mapping `.` to `./dist/index.js` and `./dist/index.d.ts`.
  - Remove all runtime tsconfig path aliases across the monorepo.
  - Remove `prisma` and `@prisma/client` from mobile app root dependencies.
  - Pin TypeScript `~6.0.3` across all workspaces.

## ADR 002: Strict Environment Variable Validation
- **Date**: 2026-10-19
- **Status**: Accepted
- **Context**: The API was starting with implicit defaults or silently failing if environment variables like `DATABASE_URL` or JWT secrets were missing or malformed.
- **Decision**: Implement a Zod schema in `apps/api/src/config/env.config.ts` that parses `process.env` immediately at startup and fails fast with actionable errors if required configurations are missing or insecure.

## ADR 003: Database Engine & Spatial Search
- **Date**: 2026-10-19
- **Status**: Accepted
- **Context**: Weyro requires radius and proximity queries for auto mechanics and damage requests.
- **Decision**: Standardize on PostgreSQL with PostGIS (`postgis/postgis:16-3.4` container). Use native PostGIS geometry/geography types with spatial GiST indexing.

## ADR 004: Production Authentication & Authorization Architecture
- **Date**: 2026-10-19
- **Status**: Accepted
- **Context**: The demo application relied on fake tokens (`jwt_demo_`), hardcoded admin secrets (`weyro_admin_super_secret_token`), client-side persona switching (`switchRole`), and insecure defaults (`cust_01`, `prov_01`). Endpoints were unauthenticated by default.
- **Decision**:
  - Secure password hashing with bcrypt (cost factor 12).
  - Short-lived JWT access tokens and stateful rotating refresh tokens stored hashed (SHA-256) in the database with revocation support.
  - Global `JwtAuthGuard` making all endpoints private by default; public routes explicitly designated via `@Public()`.
  - Role-based access control with `@Roles()` and global `RolesGuard`.
  - Admin access strictly gated to users in the database with `ADMIN` role.
  - Strict ownership checks: `customerId` and `providerId` derived exclusively from verified JWT payload (`@CurrentUser()`).
  - Provider broadcast feed and quoting privileges restricted to `VERIFIED` providers.
  - Customer phone numbers and exact street addresses masked from providers until a quotation is accepted.
  - Production security middleware: `helmet()`, environment-driven CORS allowlist, and `@nestjs/throttler` rate limiting.

## ADR 005: Correctness, Strict Validation, State Machines, and Lifecycle Automation
- **Date**: 2026-10-19
- **Status**: Accepted
- **Context**: Fallbacks in `catch` blocks silently swallowed database outages and returned fabricated mock objects. Input DTOs accepted unverified client values (such as client-calculated `totalCost`), lacked strict whitelisting against unknown payload properties, and status changes were freeform without role-based state machine enforcement.
- **Decision**:
  - Delete all in-memory mock fallbacks. `PrismaService` fails fast on boot if database is unreachable.
  - Implement a global `PrismaExceptionFilter` mapping Prisma error codes (`P2002` -> 409 Conflict, `P2025` -> 404 Not Found, `P2003` -> 400 Bad Request) and correlating each response with an `x-request-id` header.
  - Apply global `ZodValidationPipe` paired with `.strict()` schemas from `@weyro/validation` as the single source of truth to reject unknown parameters.
  - Enforce server-side calculation for quotation `totalCost` (`partsCost + labourCost + shippingCost`).
  - Quotation acceptance implemented in an atomic `prisma.$transaction` with a guarded update (`updateMany where status = PENDING`) and idempotency support to prevent race conditions and duplicate bookings.
  - Implement pure, unit-tested state machine transition validators for `ServiceRequest`, `Quotation`, `Booking`, and `Payment`.
  - Automate request and quote expiry through `@nestjs/schedule` cron tasks.
  - Reviews restricted to completed bookings and verified customers, with provider aggregate ratings recalculated in the same transaction.

## ADR 006: Payments, Razorpay Gateway, and Indian RBI PA/PG Regulatory Compliance
- **Date**: 2026-10-20
- **Status**: Accepted
- **Context**: Weyro operates as an automotive marketplace connecting Indian vehicle owners with local garages, workshops, and parts suppliers. Monetary transactions use Indian Rupee (INR) via UPI, debit/credit cards, and netbanking.
- **Decision**:
  - Integrate Razorpay payment gateway via `PaymentGateway` interface with real HMAC SHA256 cryptographic verification for payment signatures and incoming webhooks.
  - In development environments without live credentials, fallback to `MockPaymentGateway` (strictly blocked from booting in `NODE_ENV === 'production'`).
  - Idempotent webhook handling via `WebhookEvent` model with unique event IDs to prevent double capture or multiple refunds.
  - State machine transition enforcement: payments transition strictly through `PENDING -> AUTHORIZED -> CAPTURED -> REFUNDED` or `FAILED`.
  - Wire booking completion (`COMPLETED`) to trigger payment capture/release transition.
- **Legal & Regulatory Compliance (RBI PA/PG Guidelines)**:
  - Application-level "escrow" or "held" states represent internal workflow milestones.
  - Under Reserve Bank of India (RBI) Payment Aggregator and Payment Gateway (PA/PG) regulations (Guidelines on Regulation of Payment Aggregators and Payment Gateways, RBI/DPSS/2019-20/174), funds cannot be retained in an intermediary current account without a PA license or an approved Nodal/Escrow account arrangement with a scheduled commercial bank.
  - For marketplace split disbursements and vendor payouts, Weyro must either utilize an authorized Payment Aggregator's Route/Split/Marketplace product (e.g., Razorpay Route) with direct merchant onboarding and KYC, or undergo formal legal review and banking integration before initiating automated funds distribution.

## ADR 007: PostGIS Spatial Indexing, Real SQL Migrations, and Cursor Pagination
- **Date**: 2026-10-21
- **Status**: Accepted
- **Context**: Radius and proximity queries across provider profiles and damage requests previously relied on runtime trigonometric Haversine computations or dynamic geography point conversions on unindexed tables. Requests also lacked foreign key indexes, compound query indexes, and cursor-based pagination, risking performance degradation with unbounded `findMany` queries.
- **Decision**:
  - Establish baseline SQL migration (`packages/database/prisma/migrations/20261020000000_init_postgis_and_models/migration.sql`) enabling PostGIS, creating all schema tables, enums, FK constraints, and indexes.
  - Add native PostGIS `geography(Point, 4326)` columns (`location`) with GiST spatial indexes (`provider_profiles_location_idx`, `service_requests_location_idx`) and database-level trigger functions (`sync_geography_location`) that automatically synchronize coordinates on insert or update of `latitude` and `longitude`.
  - Rewrite `packages/database/src/geo.ts` to utilize `ST_DWithin` on the GiST-indexed `location` column for sub-millisecond proximity queries.
  - Implement cursor-based pagination across broadcast feed, quotations, bookings, and spare parts catalog with a strict maximum limit of 50 items to eliminate unbounded table scans.
  - Deprecate redundant `damagePhotos String[]` column in favor of the normalized `RequestMedia` relational model (`request_media` table), preserving backwards-compatible mapping across legacy API contracts.
  - Introduce `Thread`, `Message`, and `Notification` models to establish the foundation for real-time messaging and push dispatch.

## ADR 008: Presigned Object Storage, MIME Validation, and Local Decommissioning
- **Date**: 2026-10-21
- **Status**: Accepted
- **Context**: The prototype previously accepted full base64 image strings directly into the API process, wrote them synchronously to local disk in `/uploads`, and served static assets through Express with an inflated 15MB JSON request body limit. This architecture introduced security risks, memory exhaustion vectors, and scaling bottlenecks in distributed serverless or multi-container deployments.
- **Decision**:
  - Completely decommission local filesystem storage, static file serving routes, and the 15MB request payload allowance (reduced to standard 1MB).
  - Implement presigned upload URLs for S3-compatible object storage (AWS S3, Cloudflare R2, MinIO) via `StorageService` interface (`GET /api/v1/uploads/presigned-url`).
  - Restrict uploads strictly to verified image MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/heic`).
  - Rate-limit presigned URL generation (20 requests per minute) and enforce 5-minute URL expiration.
  - Return direct CDN / S3 object URLs for mobile client caching and rendering via `expo-image`.

## ADR 009: Real-time WebSocket Messaging, Expo Push Dispatch, and Room Authorization
- **Date**: 2026-10-21
- **Status**: Accepted
- **Context**: The mobile marketplace requires bidirectional communication between vehicle owners and repair providers, as well as timely push notifications for quote submissions, quote acceptance, and booking status updates.
- **Decision**:
  - Implement real-time communication using Socket.IO via `@nestjs/websockets` on namespace `/chat`.
  - Enforce JWT authentication on connection (`handleConnection`) using Bearer tokens extracted from handshake headers or auth payloads; unauthorized connections are rejected immediately.
  - Implement room authorization (`verifyParticipant`): clients can only join and broadcast to rooms (`thread_<threadId>`) if they are the customer, provider, or administrator linked to that thread.
  - Persist all messages atomically to the database with cursor-based pagination and update thread activity timestamp (`lastMessageAt`).
  - Wire push notifications via `expo-server-sdk` for background delivery:
    - Automatically create an in-app `Notification` record in the database for persistence and retrieval.
    - Dispatch push notifications to valid `ExponentPushToken[...]` device tokens using chunked batch requests.
    - Automatically prune invalid tokens from the database when Expo returns `DeviceNotRegistered`.
    - Trigger push notifications on quote receipt, quotation acceptance, booking status transitions, and incoming chat messages.

## ADR 010: Mobile Client Architecture: Secure Token Storage, Typed API Client, Enhanced Offline Queue, and Screen Decomposition
- **Date**: 2026-10-21
- **Status**: Accepted
- **Context**: The mobile client previously relied on unencrypted `AsyncStorage` for JWT tokens, raw ad-hoc `fetch` calls with hardcoded demo credentials, an unhedged offline queue prone to poison-pill retries on 4xx errors, monolithic screen components (>800 to 1,480 lines), and hardcoded demo seed state ("Marcus Vance", BMW 330i, Springfield addresses).
- **Decision**:
  - Secure Token Storage (`tokenStorage`): Migrate access and refresh tokens to `expo-secure-store` (with web fallback via localStorage) to protect tokens against unprivileged storage inspection.
  - Unified Typed API Client (`apiClient`): Centralize HTTP requests with `EXPO_PUBLIC_API_URL`, automatic Bearer auth header attachment, automatic 401 interceptor that rotates refresh tokens and retries failed requests seamlessly, and optional Zod response schema validation.
  - Enhanced Offline Mutation Queue (`offlineQueue`): Attach current JWT at send time (not queue time), assign unique idempotency keys per mutation (`Idempotency-Key` header), apply exponential backoff (up to 5 retries), and drop unrecoverable 4xx client errors to prevent permanent queue blocks.
  - Clean State & Zero Demo Seeds: Purge dummy Marcus Vance, Apex OEM, and US demo seeds; initialize the application in a clean, logged-out state with real backend synchronisation.
  - Screen Modularization: Decompose all oversized screens (`index.tsx`, `quotes.tsx`, `explore.tsx`, `admin.tsx`) to ≤ 220 lines by extracting focused, reusable UI components into `src/components/damage-post/`, `src/components/quotes/`, `src/components/explore/`, and `src/components/admin/`.

