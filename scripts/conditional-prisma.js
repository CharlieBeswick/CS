#!/usr/bin/env node
/**
 * Conditional Prisma generation
 * Only runs if DATABASE_URL is set (for Railway/backend)
 * Skips for Netlify (frontend-only builds)
 */

if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL detected, generating Prisma client...');
  const { execSync } = require('child_process');
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
  } catch (error) {
    console.error('Prisma generation failed:', error.message);
    process.exit(1);
  }
} else {
  console.log('Skipping Prisma generate (DATABASE_URL not set - likely Netlify frontend build)');
}

