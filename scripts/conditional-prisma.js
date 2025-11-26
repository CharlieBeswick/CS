#!/usr/bin/env node
/**
 * Conditional Prisma generation
 * Only runs if DATABASE_URL is set (for Railway/backend)
 * Skips for Netlify (frontend-only builds)
 */

// Check if we're in a Railway/Railway-like environment
// Railway sets DATABASE_URL during build, but we should be resilient
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL detected, generating Prisma client...');
  const { execSync } = require('child_process');
  try {
    execSync('npx prisma generate', { stdio: 'inherit', timeout: 60000 });
    console.log('✅ Prisma client generated successfully');
  } catch (error) {
    console.error('⚠️  Prisma generation failed:', error.message);
    console.log('⚠️  Continuing build - Prisma will be generated on startup if needed');
    // Don't exit - let the build continue, Prisma can be generated later
  }
} else {
  console.log('Skipping Prisma generate (DATABASE_URL not set - likely Netlify frontend build)');
}

