#!/bin/bash
# Railway startup script
# Handles database setup and server startup

set -e

echo "🚀 Starting Crypto Snow backend..."

# Set default DATABASE_URL if not provided (for SQLite)
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:./prisma/dev.db"
  echo "⚠️  DATABASE_URL not set, using default: $DATABASE_URL"
fi

# Run migrations (will create database if it doesn't exist)
echo "📦 Running database migrations..."
npx prisma migrate deploy || {
  echo "⚠️  Migration failed, attempting to initialize database..."
  npx prisma migrate dev --name init || echo "⚠️  Migration initialization failed, continuing..."
}

# Start the server
echo "✅ Starting server..."
exec npm start





