# Railway Deployment Setup Guide

## ⚠️ CRITICAL: Set Environment Variables First!

Before deploying, you **MUST** set these environment variables in Railway:

### 1. Database URL (REQUIRED)
```
DATABASE_URL=file:./prisma/dev.db
```

**For SQLite persistence, add a Railway Volume:**
1. In Railway dashboard → Your service → "New" → "Volume"
2. Mount path: `/app/prisma`
3. This prevents database from being wiped on redeploy

**OR switch to PostgreSQL (Recommended for production):**
1. Add PostgreSQL service in Railway (it auto-sets DATABASE_URL)
2. Update `prisma/schema.prisma` to use `provider = "postgresql"`
3. Run migrations

### Session Security (Required for Production)
```
SESSION_SECRET=your-random-secret-key-here-minimum-32-characters
```

### Google OAuth (Optional - for authentication)
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Node Environment
```
NODE_ENV=production
```

## Database Setup

**Current Setup: SQLite**
- The app uses SQLite by default
- Database file location: `prisma/dev.db`
- **You MUST add a Railway Volume** to persist the database, or it will be wiped on every redeploy

**Recommended: Switch to PostgreSQL**
For production, consider switching to PostgreSQL:
1. Add PostgreSQL service in Railway
2. Railway will auto-set `DATABASE_URL`
3. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. Run migrations: `npx prisma migrate deploy`

## Troubleshooting

### Build Fails
- Check Railway logs for specific error messages
- Ensure `DATABASE_URL` is set correctly
- Verify all dependencies are in `package.json`

### Database Issues
- If using SQLite, ensure volume is mounted at `/app/prisma`
- Check that migrations have run: `npx prisma migrate status`

### Server Won't Start
- Check that `PORT` environment variable is set (Railway sets this automatically)
- Verify `npm start` works locally
- Check Railway logs for startup errors

