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

