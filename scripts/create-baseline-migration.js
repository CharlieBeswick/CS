#!/usr/bin/env node
/**
 * Create a baseline PostgreSQL migration
 * This script ensures the migration is generated with proper UTF-8 encoding
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Creating baseline PostgreSQL migration...');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  console.log('ℹ️  This script should be run with DATABASE_URL pointing to your PostgreSQL database');
  process.exit(1);
}

try {
  // First, use db push to get the schema into the database
  // This bypasses migration history and directly applies the schema
  console.log('🚀 Pushing schema to database (this will create all tables)...');
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  console.log('✅ Schema pushed successfully');
  console.log('📝 Now creating baseline migration from current database state...');
  
  // Now create a baseline migration that matches the current DB state
  // This will generate a clean UTF-8 migration file
  execSync('npx prisma migrate dev --name init --create-only', {
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  console.log('✅ Baseline migration created');
  console.log('ℹ️  Migration file should be in prisma/migrations/');
  
} catch (error) {
  console.error('❌ Error creating migration:', error.message);
  process.exit(1);
}



