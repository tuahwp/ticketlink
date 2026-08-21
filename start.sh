#!/bin/sh
set -e

# Fix permissions for uploads directory.
# The Coolify persistent volume mount may be owned by root at runtime,
# so we ensure nextjs user (uid 1001) can always write to it.
mkdir -p /app/public/uploads
chown -R 1001:1001 /app/public/uploads

# Run database migrations before starting the app.
# Uses DIRECT_URL env var (set in Coolify) which bypasses PgBouncer pooling
# required for DDL statements.
echo "Running database migrations..."
npx prisma migrate deploy --schema=/app/prisma/schema.prisma
echo "Migrations complete."

# Drop privileges to nextjs user and start the app
exec su-exec nextjs node server.js
