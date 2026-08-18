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

# su-exec: lightweight tool to drop root privileges to a specific user at runtime
# Needed so the entrypoint can fix volume permissions then start app as nextjs
RUN apk add --no-cache su-exec

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output + static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy full node_modules so all Prisma CLI dependencies are available
# (needed for `prisma migrate deploy` from terminal and runtime DB access)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma generated client + schema for migrations
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy entrypoint script — fixes upload dir permissions then starts app
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# NOTE: We do NOT set USER nextjs here.
# start.sh runs as root, fixes /app/public/uploads ownership, then
# uses su-exec to drop to nextjs (uid 1001) before starting node.

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "start.sh"]
