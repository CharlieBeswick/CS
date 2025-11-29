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
  // First, try to fix any failed migration state (from SQLite to PostgreSQL switch)
  try {
    console.log('🔧 Checking migration state...');
    require('./fix-migration-state.js');
  } catch (error) {
    console.log('ℹ️  Migration state check skipped:', error.message);
  }
  
  // Check if migrations directory exists and has migrations
  const fs = require('fs');
  const path = require('path');
  const migrationsPath = path.join(__dirname, '..', 'prisma', 'migrations');
  const hasMigrations = fs.existsSync(migrationsPath) && 
    fs.readdirSync(migrationsPath).some(item => 
      fs.statSync(path.join(migrationsPath, item)).isDirectory() && 
      item !== 'migration_lock.toml'
    );
  
  if (!hasMigrations) {
    // No migrations exist - use db push to bootstrap the schema
    console.log('📦 No migrations found - using db push to bootstrap schema...');
    try {
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit', timeout: 60000 });
      console.log('✅ Schema pushed successfully');
    } catch (error) {
      console.warn('⚠️  db push failed:', error.message);
      console.log('⚠️  Continuing anyway - server will start');
    }
  } else {
    // Migrations exist - run migrate deploy
    console.log('📦 Running database migrations...');
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit', timeout: 30000 });
      console.log('✅ Migrations completed successfully');
    } catch (error) {
      console.warn('⚠️  Migration failed or database not ready:', error.message);
      console.log('⚠️  Continuing anyway - server will start and migrations can be retried');
    }
  }
}

// Start the server directly by requiring it
// This keeps the process alive since server.js starts the Express server
console.log('🌐 Starting server...');
console.log(`📊 Environment check:`);
console.log(`   - PORT: ${process.env.PORT || 'not set (will use 3000)'}`);
console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

// Ensure the process doesn't exit
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Keep process alive
require('../server.js');

