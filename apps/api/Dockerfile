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

# Copy root package.json and built node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
# Nested workspace node_modules that npm did not hoist (e.g. @nestjs/jwt)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

# Run as the unprivileged node user shipped with the base image.
USER node

CMD ["node", "apps/api/dist/main.js"]
