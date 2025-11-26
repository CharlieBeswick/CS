# Railway Deployment - Quick Fix Checklist

## ✅ What I Fixed

1. **Updated `railway.json`**:
   - Separated build and deploy commands
   - Added proper migration step in startup
   - Created `railway:start` script in package.json

2. **Created startup script** (`start.sh`) for manual use if needed

3. **Added documentation** (`RAILWAY_SETUP.md`) with full setup guide

## 🔧 What You Need to Do in Railway Dashboard

### Step 1: Set Environment Variables
Go to your Railway project → Variables tab, add:

```
DATABASE_URL=file:./prisma/dev.db
SESSION_SECRET=your-random-secret-key-minimum-32-chars
NODE_ENV=production
```

### Step 2: Add Volume (For SQLite Persistence)
1. In Railway dashboard → Your service
2. Click "New" → "Volume"
3. Name: `database`
4. Mount path: `/app/prisma`
5. This keeps your database between redeploys

### Step 3: Deploy
Push your changes or trigger a redeploy. Railway will:
1. Run `npm install`
2. Generate Prisma client
3. Run migrations on startup
4. Start the server

## 🐛 Common Issues & Fixes

### "Migration failed" error
- **Cause**: DATABASE_URL not set or database file doesn't exist
- **Fix**: Set DATABASE_URL in Railway variables

### "Database locked" error
- **Cause**: SQLite file permissions or concurrent access
- **Fix**: Ensure volume is mounted correctly, or switch to PostgreSQL

### "Port already in use"
- **Cause**: Railway sets PORT automatically, this shouldn't happen
- **Fix**: Check Railway logs, ensure no duplicate services

### Build takes forever
- **Cause**: npm install downloading large dependencies
- **Fix**: This is normal, first build takes 2-5 minutes

## 📊 Check Deployment Status

1. Go to Railway dashboard → Your service → "Deployments"
2. Click on the latest deployment
3. Check "Build Logs" for build errors
4. Check "Deploy Logs" for runtime errors

## 🎯 Next Steps After Deployment

1. Test the health endpoint: `https://your-app.railway.app/api/health`
2. Check server logs in Railway dashboard
3. Verify database is persisting (if using volume)
4. Test authentication endpoints

