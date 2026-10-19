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
