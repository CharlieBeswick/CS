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

    // Delete ALL failed migrations (both old SQLite and new PostgreSQL ones)
    // This allows new migrations to apply
    // We delete:
    // 1. Old SQLite migrations (Nov 23-26)
    // 2. Any migration that failed (finished_at IS NULL but started_at IS NOT NULL)
    // 3. The new PostgreSQL migration if it failed
    const result = await client.query(`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name LIKE '20251123%' 
         OR migration_name LIKE '20251124%'
         OR migration_name LIKE '20251125%'
         OR migration_name LIKE '20251126%'
         OR migration_name = '20251129131500_init_postgresql'
         OR (finished_at IS NULL AND started_at IS NOT NULL)
         OR rolled_back_at IS NOT NULL;
    `);

    if (result.rowCount > 0) {
      console.log(`✅ Cleaned up ${result.rowCount} old/failed migration(s) from history`);
    } else {
      console.log('ℹ️  No old migrations found to clean up');
    }
    
    // Also check if there are any partially applied migrations that need cleanup
    // Sometimes migrations fail partway through and leave the database in a bad state
    const failedCheck = await client.query(`
      SELECT migration_name, started_at, finished_at 
      FROM "_prisma_migrations" 
      WHERE finished_at IS NULL AND started_at IS NOT NULL;
    `);
    
    if (failedCheck.rows.length > 0) {
      console.log(`⚠️  Found ${failedCheck.rows.length} failed migration(s) still in database`);
      console.log('⚠️  These will be cleaned up on next run');
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

