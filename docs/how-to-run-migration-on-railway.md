# How to Run Migration on Railway - Step by Step

## Option 1: Use Railway CLI (Easiest)

### Step 1: Install Railway CLI

**On Windows (PowerShell):**
```powershell
npm i -g @railway/cli
```

**Or using the installer:**
```powershell
# Download and run the installer
iwr https://railway.app/install.ps1 | iex
```

### Step 2: Login to Railway

```bash
railway login
```
This will open a browser window for you to authenticate.

### Step 3: Link to Your Project

Navigate to your project folder (where your code is):
```bash
cd C:\Users\QC\Desktop\Tombolawebapp\tombola-live
railway link
```

This will show you a list of your Railway projects - select the one for this app.

### Step 4: SSH into Railway and Run the Migration

**Important:** You can't run `railway run` locally because Railway's database uses internal hostnames. You need to SSH into the Railway container.

```bash
railway ssh
```

This will open a shell **inside your Railway service**. Then run:

```bash
npx prisma db push
```

This will:
- Connect to your Railway database (from inside Railway's network)
- Create the `AuthToken` table
- Complete immediately

Type `exit` when done to leave the SSH session.

**That's it!** The table will be created and Safari login should work.

---

## Option 2: Wait for Automatic Migration

Railway's startup script **automatically runs migrations** on every deploy. 

**What happens:**
1. You push code to GitHub
2. Railway detects the deployment
3. Railway runs `npm run railway:start`
4. The startup script runs `npx prisma db push` (if no migrations exist)
5. The `AuthToken` table gets created
6. Server starts

**To check if it worked:**
1. Go to Railway Dashboard
2. Click on your service
3. Go to **"Logs"** tab
4. Look for: `✅ Schema pushed successfully`

If you see that message, the table was created!

---

## Option 3: Trigger a Redeploy

If you want to force Railway to run the migration:

1. Go to Railway Dashboard
2. Click on your service
3. Look for **"Redeploy"** or **"Deploy"** button
4. Click it to trigger a new deployment
5. Check the logs to see if migration ran

---

## How to Verify It Worked

After running the migration (via CLI or automatic), verify:

### Check Railway Logs:
Look for:
- `✅ Schema pushed successfully`
- OR `✅ Migrations completed successfully`
- No errors about "relation does not exist"

### Test Safari Login:
1. Try logging in on Safari
2. Check browser console - should see `[AUTH] Token verified, user authenticated`
3. Should redirect to lobby successfully

---

## Troubleshooting

### "Can't reach database server at postgres.railway.internal"
- **This is normal!** Railway's internal hostnames only work from inside Railway's network
- **Solution:** Use `railway ssh` to connect to your service, then run `npx prisma db push` from inside
- OR wait for automatic migration on deploy (check logs)

### "Command not found: railway"
- Make sure Railway CLI is installed: `npm i -g @railway/cli`
- Or use the installer: `iwr https://railway.app/install.ps1 | iex`

### "Not linked to a project"
- Run `railway link` in your project directory
- Select your project from the list

### "DATABASE_URL not set"
- Railway should set this automatically if you have a PostgreSQL database
- Check Railway Dashboard → Your PostgreSQL Service → Variables
- Make sure `DATABASE_URL` is there

### Migration still fails
- Check Railway logs for specific error messages
- Make sure PostgreSQL database is provisioned
- Verify `DATABASE_URL` is correct

---

## Quick Reference

**Easiest method:**
```bash
npm i -g @railway/cli
railway login
railway link
railway run npx prisma db push
```

**Or just wait** - Railway will do it automatically on next deploy!

---

**Last Updated:** December 2024

