# How to Run Prisma Migration on Railway

## Quick Answer

**Railway will automatically run migrations on deploy!** Just push your code and Railway's startup script will handle it.

---

## Option 1: Automatic (Recommended) ✅

Railway's startup script (`scripts/railway-start.js`) automatically runs migrations on every deploy.

**What happens:**
1. You push code to GitHub
2. Railway detects the deployment
3. Railway runs `npm run railway:start`
4. The startup script runs `npx prisma migrate deploy`
5. Migration creates the `AuthToken` table
6. Server starts

**To verify it worked:**
1. Go to Railway Dashboard → Your Service → Logs
2. Look for: `📦 Running database migrations...`
3. Look for: `✅ Migrations completed successfully`
4. If you see errors, check the logs for details

**If migration fails:**
- Check Railway logs for error messages
- Verify `DATABASE_URL` is set in Railway environment variables
- Make sure PostgreSQL database is provisioned

---

## Option 2: Manual via Railway CLI

If you have Railway CLI installed:

```bash
# Install Railway CLI (if not installed)
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migration manually
railway run npx prisma migrate deploy
```

---

## Option 3: Manual via Railway Web Interface

1. Go to Railway Dashboard → Your Service
2. Click on the service
3. Go to **"Deployments"** tab
4. Click **"New Deployment"** → **"Deploy from GitHub"**
5. Or use **"Shell"** tab to run:
   ```bash
   npx prisma migrate deploy
   ```

---

## Option 4: Create Migration File First (Advanced)

If you want to create the migration file locally first (requires DATABASE_URL):

```bash
# Set DATABASE_URL temporarily (use Railway's connection string)
export DATABASE_URL="postgresql://user:password@host:port/database"

# Create migration file
npx prisma migrate dev --name add_auth_token_model --create-only

# This creates a migration file in prisma/migrations/
# Then commit and push - Railway will run it automatically
```

**Note:** You can get your Railway DATABASE_URL from:
- Railway Dashboard → Your PostgreSQL Service → Variables → `DATABASE_URL`

---

## Verifying the Migration Worked

After deployment, verify the `AuthToken` table exists:

### Via Railway Shell:
```bash
railway run npx prisma studio
# Or
railway run npx prisma db execute --stdin
# Then run: SELECT * FROM "AuthToken" LIMIT 1;
```

### Via Logs:
Check Railway logs for:
- `✅ Migrations completed successfully`
- No errors about `AuthToken` table not found

### Via API:
Try logging in on Safari - if it works, the migration succeeded!

---

## Troubleshooting

### Migration fails with "relation does not exist"
- The migration hasn't run yet
- Wait for Railway to finish deploying
- Check logs for migration errors

### Migration fails with "already exists"
- Table already created (migration already ran)
- This is fine - no action needed

### Migration fails with "connection refused"
- Database isn't ready yet
- Wait a few seconds and try again
- Check DATABASE_URL is correct

### No migrations found
- Railway will use `prisma db push` instead
- This is fine - it will create the table
- Future changes should use migrations

---

## Current Setup

Your Railway configuration:
- **Start Command:** `npm run railway:start`
- **Startup Script:** `scripts/railway-start.js`
- **Migration Command:** `npx prisma migrate deploy`
- **Auto-runs:** ✅ Yes, on every deploy

---

## Summary

**Easiest way:** Just push your code! Railway will automatically:
1. Detect the schema change
2. Run the migration
3. Create the `AuthToken` table
4. Start the server

**Check logs** to verify it worked.

---

**Last Updated:** December 2024

