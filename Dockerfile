# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies required for native modules (e.g. better-sqlite3)
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Build application ───────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy installed deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before build
RUN npx prisma generate

# Build Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only necessary build output
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy Next.js standalone output + static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma generated client (needed at runtime)
# Prisma v7 with custom output writes to src/generated only — no node_modules/.prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/pg ./node_modules/pg
# Copy prisma package so `prisma/config` resolves when running migrations from terminal
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# Copy .bin so `npx prisma` / `./node_modules/.bin/prisma` resolves correctly
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin

# Copy Prisma schema + config so migrations can be run from container terminal
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Create uploads directory and give nextjs user write permission
# This is the persistent volume mount point — Coolify will mount here
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
