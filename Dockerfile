# ─── Stage 1: All dependencies (with build tools for native modules) ──────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Production-only dependencies (for prisma CLI at runtime) ────────
FROM node:22-alpine AS prod-deps
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 2: Build application ───────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Need build tools for native modules (e.g. pg native)
RUN apk add --no-cache libc6-compat python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before build
RUN npx prisma generate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# su-exec: drop root privileges to nextjs user at runtime
RUN apk add --no-cache su-exec

# Need build tools for native pg modules at runtime
RUN apk add --no-cache python3 make g++ libc6-compat

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output (includes its own node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy Prisma generated client + schema (needed at runtime for queries)
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy entrypoint script and migration runner
COPY start.sh ./start.sh
COPY migrate.js ./migrate.js
RUN chmod +x ./start.sh

# Copy prod node_modules so `npx prisma migrate deploy` works at startup
# (standalone output doesn't include the prisma CLI binary)
COPY --from=prod-deps /app/node_modules ./node_modules

# NOTE: Container starts as root (via start.sh), fixes /app/public/uploads
# ownership, then su-exec drops to nextjs (uid 1001) before starting node.

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "start.sh"]
