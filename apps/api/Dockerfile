# Stage 1: Build
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy workspace configurations
COPY package.json package-lock.json ./
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY packages/validation/package.json ./packages/validation/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies
RUN npm ci
# The lockfile is authored on macOS; install the Linux sharp binary
# explicitly so the runtime image does not look for a darwin build.
RUN npm install --os=linux --libc=glibc --cpu=x64 sharp

# Copy source trees (tsconfig.base.json is extended by package tsconfigs — required)
COPY tsconfig.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client and build packages
RUN npm run build:packages
RUN npm run build:api

# Stage 2: Runner
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

# M11: install ONLY what the API needs at runtime (no mobile / Expo / test /
# build tooling). Manifests first so this layer is cached until deps change.
COPY package.json package-lock.json ./
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY packages/validation/package.json ./packages/validation/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

# --omit=dev drops devDependencies; -w limits the install to the API workspace
# (and the @weyro/* packages it depends on). `prisma` is a production dependency
# of @weyro/database on purpose: the Railway pre-deploy step runs
# `prisma migrate deploy` inside this image.
RUN npm ci --omit=dev -w @weyro/api --include-workspace-root
# The lockfile is authored on macOS; add the Linux sharp binary explicitly so the
# runtime image does not look for a darwin build (same fix as the builder stage).
RUN npm install --omit=dev --no-save --os=linux --libc=glibc --cpu=x64 sharp -w @weyro/api

# Built workspace packages (dist) + the Prisma schema/migrations used by pre-deploy.
COPY --from=builder /app/packages/api-contracts/dist ./packages/api-contracts/dist
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
# The generated Prisma clients. Each workspace resolves its own @prisma/client
# copy, so each one needs its generated output (see the generators in schema.prisma).
COPY --from=builder /app/packages/database/node_modules/.prisma ./packages/database/node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

# Run as the unprivileged node user shipped with the base image.
USER node

CMD ["node", "apps/api/dist/main.js"]
