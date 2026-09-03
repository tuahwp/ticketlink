#!/bin/sh
set -e

# Fix permissions for uploads directory.
mkdir -p /app/public/uploads
chown -R 1001:1001 /app/public/uploads

# Run database migrations/schema push before starting the app.
echo "Running database schema sync..."
node migrate.js || true
echo "Database schema sync step complete."

# Drop privileges to nextjs user and start the app
exec su-exec nextjs node server.js
