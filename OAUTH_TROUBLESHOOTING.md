# OAuth "Client Not Found" Troubleshooting

## Current Status
- Client ID in code: `471918731686-11a6qm3hlqgablic5ks7u24ob5ghd800.apps.googleusercontent.com`
- Client ID in Google Cloud: `471918731686-11a6qm3hlqgablic5ks7u24ob5ghd800.apps.googleusercontent.com` ✅ MATCHES
- Authorized origins: Both domains added ✅
- Authorized redirect URIs: Both domains added ✅

## Possible Issues

### 1. OAuth Consent Screen Not Configured
The OAuth client might exist but the consent screen might not be set up.

**Check:**
- Google Cloud Console → APIs & Services → OAuth consent screen
- Make sure it's configured (even if in "Testing" mode)
- Add your email as a test user if in testing mode

### 2. Project Mismatch
Make sure you're using the Client ID from the correct Google Cloud project.

**Verify:**
- The project name in Google Cloud Console matches
- The Client ID is from the "Tombola App" project (as shown in screenshot)

### 3. Client ID Status
Check if the OAuth client is enabled/active.

**Check:**
- Google Cloud Console → Credentials → Your OAuth client
- Make sure it's not deleted or disabled

### 4. Browser Cache
The browser might be caching old JavaScript.

**Try:**
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Use incognito/private window
- Check browser console for the Client ID being used

### 5. Netlify Deployment
Make sure Netlify has deployed the latest code with the correct Client ID.

**Check:**
- Netlify Dashboard → Deployments
- Verify the latest commit (with Client ID fix) is deployed
- Check the deployed JavaScript file to confirm Client ID

### 6. Google API Propagation
Google changes can take time to propagate.

**Wait:**
- 5-10 minutes after saving changes
- Sometimes up to an hour

## Debug Steps

1. **Check Browser Console:**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for the log: "Initializing Google Sign-In with Client ID: ..."
   - Verify it matches exactly

2. **Verify Deployed Code:**
   - Go to: `https://crypto-snow.netlify.app/app.js`
   - Search for: `471918731686-11a6qm3hlqgablic5ks7u24ob5ghd800`
   - Make sure it's in the deployed file

3. **Check OAuth Consent Screen:**
   - Google Cloud Console → OAuth consent screen
   - Make sure it's configured (not just the client)

4. **Test with Different Browser:**
   - Try Chrome, Firefox, Edge
   - Use incognito mode

