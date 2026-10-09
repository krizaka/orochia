# -------------------------------------------------------------
# Production Multi-Stage Dockerfile for Orochia Platform
# -------------------------------------------------------------
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 1. Dependency installation stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/media/package.json ./packages/media/
COPY packages/payments/package.json ./packages/payments/
COPY packages/push/package.json ./packages/push/
COPY packages/config/package.json ./packages/config/
RUN npm ci

# 2. Builder stage
FROM base AS builder
WORKDIR /app
# Everything npm ci installed — the root node_modules and any workspace-level node_modules (a dependency npm
# could not hoist, e.g. apps/web/node_modules).
COPY --from=deps /app ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build-time values (App Platform passes RUN_AND_BUILD_TIME variables as build args): the public
# origin inlined in the client bundle and in prerendered pages, and whether search engines may index.
ARG NEXT_PUBLIC_APP_URL
ARG SEARCH_INDEXING
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV SEARCH_INDEXING=$SEARCH_INDEXING

# Generate build output for Next.js standalone
RUN npm run build --workspace=@orochia/web

# Self-contained migrator (drizzle-orm + pg bundled): run as the PRE_DEPLOY job
RUN npm run build:migrator --workspace=@orochia/db

# 3. Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Database migrations: `node migrate.cjs` applies ./drizzle to DATABASE_URL
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/dist/migrate.cjs ./migrate.cjs
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle ./drizzle

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
