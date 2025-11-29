# Database Persistence Fix - Critical Issue

## 🔴 The Problem

Your database (game history, player lists, etc.) is being wiped every time Railway redeploys because:

1. **You're using SQLite** - a file-based database (`file:./prisma/dev.db`)
2. **Railway wipes the filesystem** on every redeploy
3. **No persistent storage** - the database file is lost each time

## ✅ Solution Options

### Option 1: Add Railway Volume (Quick Fix - SQLite)

This keeps your SQLite database file between redeploys.

**Steps:**
1. Go to Railway Dashboard → Your service
2. Click **"New"** → **"Volume"**
3. Configure:
   - **Name:** `database` (or any name)
   - **Mount Path:** `/app/prisma` (MUST be exactly this)
   - **Size:** 1GB is plenty (SQLite files are small)
4. Click **"Add"**

**Important:** The mount path `/app/prisma` must match where your database file is located. Railway will persist this directory between redeploys.

**After adding the volume:**
- Your next deployment will create a fresh database (since the volume is empty)
- But from then on, the database will persist between redeploys
- ⚠️ **You'll lose existing data once** when you add the volume (it starts empty)

---

### Option 2: Switch to PostgreSQL (Recommended for Production)

PostgreSQL is a proper database server that Railway manages for you. It's more reliable and scales better.

**Steps:**

1. **Add PostgreSQL Service in Railway:**
   - Go to Railway Dashboard → Your project
   - Click **"New"** → **"Database"** → **"Add PostgreSQL"**
   - Railway will automatically create a PostgreSQL database
   - Railway will automatically set `DATABASE_URL` environment variable

2. **Update Prisma Schema:**
   Change `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"  // Change from "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

3. **Run Migrations:**
   Railway will automatically run migrations on deploy, OR you can run manually:
   ```bash
   npx prisma migrate deploy
   ```

4. **Deploy:**
   - Push your changes
   - Railway will detect the schema change and run migrations
   - Your data will be preserved in PostgreSQL

**Benefits:**
- ✅ Data persists automatically (Railway manages it)
- ✅ Better performance for concurrent users
- ✅ No file system issues
- ✅ Can scale horizontally
- ✅ Built-in backups (Railway handles this)

---

## 🚨 Immediate Action Required

**If you have important data you want to keep:**

1. **Export your current data** (if possible):
   - Use Railway's shell/CLI to access the database
   - Export data before making changes

2. **Choose your solution:**
   - **Quick fix:** Add Railway Volume (Option 1) - but you'll lose data once
   - **Best long-term:** Switch to PostgreSQL (Option 2) - recommended

3. **After implementing:**
   - Your database will persist between redeploys
   - Game history and player lists will be saved
   - No more data loss on updates

---

## 📋 Current Configuration Check

**Your current setup:**
- Database: SQLite (`file:./prisma/dev.db`)
- Location: `prisma/dev.db` (relative to project root)
- Persistence: ❌ **NONE** - wiped on every redeploy

**What needs to change:**
- Either add Volume at `/app/prisma` (Option 1)
- Or switch to PostgreSQL (Option 2)

---

## 🔍 How to Verify It's Working

After implementing either solution:

1. **Create some test data** (add a user, play a game)
2. **Trigger a redeploy** (push a code change)
3. **Check if data persists** (user should still exist, game history should remain)

If data persists → ✅ Fixed!
If data is still wiped → Check Railway logs and volume/database configuration

---

## 💡 Recommendation

**For production:** Use PostgreSQL (Option 2)
- More reliable
- Better performance
- Railway manages backups
- No file system issues

**For quick fix:** Use Railway Volume (Option 1)
- Faster to set up
- Keeps using SQLite
- But you'll lose data once when adding the volume

