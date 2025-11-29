#!/usr/bin/env node
/**
 * Fix migration state - clean up failed SQLite migrations
 * This allows new PostgreSQL migrations to apply
 * Uses direct PostgreSQL connection to avoid Prisma Client dependency
 */

const { Client } = require('pg');

async function fixMigrationState() {
  console.log('🔧 Fixing migration state...');

  if (!process.env.DATABASE_URL) {
    console.log('ℹ️  DATABASE_URL not set - skipping migration state fix');
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('📡 Connected to database');

    // Check if _prisma_migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_prisma_migrations'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    if (!tableExists) {
      console.log('ℹ️  Migration table does not exist yet - will be created by first migration');
      return;
    }

    // Delete failed SQLite migrations from the migration history
    // This allows new PostgreSQL migrations to apply
    const result = await client.query(`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name LIKE '20251123%' 
         OR migration_name LIKE '20251124%'
         OR migration_name LIKE '20251125%'
         OR migration_name LIKE '20251126%'
         OR finished_at IS NULL
         OR rolled_back_at IS NOT NULL;
    `);

    if (result.rowCount > 0) {
      console.log(`✅ Cleaned up ${result.rowCount} old/failed migration(s) from history`);
    } else {
      console.log('ℹ️  No old migrations found to clean up');
    }
  } catch (error) {
    // If table doesn't exist or query fails, that's OK - migrations will create it
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      console.log('ℹ️  Migration table not found - will be created by migrations');
    } else {
      console.warn('⚠️  Could not clean migration state:', error.message);
      console.log('⚠️  This might be OK - migrations will attempt to proceed anyway');
    }
  } finally {
    await client.end();
  }
}

fixMigrationState().catch(console.error);

