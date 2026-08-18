# ─── Stage 1: All dependencies (with build tools for native modules) ──────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Production-only dependencies ────────────────────────────────────
FROM node:22-alpine AS prod-deps
WORKDIR /app

# Need build tools for native modules (e.g. better-sqlite3) even in prod
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 3: Build application ───────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before build
RUN npx prisma generate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 4: Production runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# su-exec: drop root privileges to nextjs user at runtime
RUN apk add --no-cache su-exec

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output + static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy production-only node_modules (much smaller than full node_modules)
# prisma is in dependencies so it's included here for `prisma migrate deploy`
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy Prisma generated client + schema for migrations
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy entrypoint script — fixes upload dir permissions then starts app
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# NOTE: Container starts as root (via start.sh), fixes /app/public/uploads
# ownership, then su-exec drops to nextjs (uid 1001) before starting node.

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "start.sh"]
