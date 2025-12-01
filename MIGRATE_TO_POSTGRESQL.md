# Migrate to PostgreSQL - Step by Step Guide

## Why PostgreSQL?

- ✅ Data persists automatically (Railway manages it)
- ✅ No file system issues
- ✅ Better performance
- ✅ Built-in backups
- ✅ Scales better

## Step-by-Step Migration

### Step 1: Add PostgreSQL in Railway

1. Go to Railway Dashboard → Your project
2. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically:
   - Create a PostgreSQL database
   - Set `DATABASE_URL` environment variable
   - You don't need to configure anything else

### Step 2: Update Prisma Schema

The schema file is already set up to work with both SQLite and PostgreSQL. You just need to change the provider:

**File: `prisma/schema.prisma`**

Change line 9:
```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite" to "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 3: Deploy to Railway

1. Commit and push the schema change
2. Railway will automatically:
   - Detect the schema change
   - Run `npx prisma migrate deploy` on startup
   - Create all tables in PostgreSQL

### Step 4: Verify

1. Check Railway logs - should see "Migrations completed successfully"
2. Test your app - create a user, play a game
3. Trigger a redeploy - data should persist

## ⚠️ Important Notes

- **Existing SQLite data will NOT be migrated automatically**
- If you have important data, you'll need to export it first
- The new PostgreSQL database will start empty
- All new data will be saved in PostgreSQL

## After Migration

Your database will now:
- ✅ Persist between redeploys automatically
- ✅ Be backed up by Railway
- ✅ Handle concurrent users better
- ✅ Scale as needed

## Rollback (if needed)

If you need to go back to SQLite:
1. Change schema back to `provider = "sqlite"`
2. Set `DATABASE_URL=file:./prisma/dev.db` in Railway
3. Add Railway Volume at `/app/prisma` (see Option 1 in DATABASE_PERSISTENCE_FIX.md)



