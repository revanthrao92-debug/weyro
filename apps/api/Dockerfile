# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy workspace configurations
COPY package.json package-lock.json ./
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY packages/validation/package.json ./packages/validation/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies
RUN npm ci

# Copy source trees
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client and build packages
RUN npm run build:packages
RUN npm run build:api

# Stage 2: Runner
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=4000

# Copy root package.json and built node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
