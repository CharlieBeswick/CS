#!/usr/bin/env node
/**
 * Railway startup script
 * Handles migrations gracefully and starts the server
 */

const { execSync } = require('child_process');

console.log('🚀 Starting Railway deployment...');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - skipping migrations');
  console.log('⚠️  Server will start but database features may not work');
} else {
  // Try to run migrations
  console.log('📦 Running database migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', timeout: 30000 });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.warn('⚠️  Migration failed or database not ready:', error.message);
    console.log('⚠️  Continuing anyway - server will start and migrations can be retried');
  }
}

// Start the server directly by requiring it
// This keeps the process alive since server.js starts the Express server
console.log('🌐 Starting server...');
require('../server.js');

