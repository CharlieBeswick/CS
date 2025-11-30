# Safari Ticket Wallet Investigation Report

**Date:** November 2024  
**Issue:** Safari shows error popup and 0 tickets even though tickets are granted on backend  
**Status:** Under Investigation

---

## Summary

Safari users experience two related issues:
1. **Watch Ad Error Popup:** After tapping "Watch Ad", users see "Safari blocked the session cookie" error even though the ticket is successfully granted (verified in admin panel and Chrome)
2. **Wallet Shows 0 Tickets:** The ticket wallet UI always displays 0 for all tiers on Safari, even when the user has tickets in the database

**Key Observation:** Backend state is correct (tickets are granted, wallet has data), but Safari frontend displays incorrect information.

---

## Code Paths

### Wallet Loading Flow

**File:** `public/app.js`

**Function:** `loadWallet(retryCount = 0)` (lines 931-1010)

**Called From:**
- `loadTicketsScreen()` (line 905) - when My Tickets page opens
- `setCurrentUser()` (line 789) - after login, with 500ms delay
- `renderPrizesBreakdown()` (line 3139) - if wallet not loaded

**Flow:**
1. Gets auth headers via `getAuthHeaders()` (includes token if available)
2. Fetches `${API_BASE}/api/wallet` with credentials and headers
3. Checks for 401 status → retries up to 5 times with delays
4. If 401 after retries → sets wallet to all zeros and returns
5. Parses JSON response
6. Checks `if (data.ok && data.wallet)`:
   - **Success:** Sets `appState.wallet = data.wallet` and calls `renderWalletGrid()`
   - **Failure:** Sets wallet to all zeros and calls `renderWalletGrid()`
7. **Catch block:** On any error, sets wallet to all zeros

**Rendering:** `renderWalletGrid()` (lines 1012-1040)
- Reads from `appState.wallet[tier] || 0`
- Displays balance for each tier

### Watch Ad Flow

**File:** `public/app.js`

**Function:** `handleWatchAd()` (lines 1290-1400)

**Called From:**
- Button click handler: `document.getElementById('watchAdBtn')` (line 391)

**Flow:**
1. Verifies user is logged in
2. **Session verification:** Calls `/auth/me` to check session (lines 1269-1280)
   - If fails → shows error and returns early
3. Starts 5-second countdown using `requestAnimationFrame`
4. After countdown, calls `callAdRewardsAPI()`
5. **Success handler:** Checks `if (data.ok)`, updates wallet, shows success alert
6. **Error handler:** Shows error message (including "Safari blocked..." message)

**Function:** `callAdRewardsAPI(retryCount = 0)` (lines 1198-1288)

**Flow:**
1. Gets auth headers via `getAuthHeaders()`
2. Fetches `${API_BASE}/api/rewards/ad` POST with credentials and headers
3. Checks for 401 status → retries up to 5 times
4. If 401 after retries AND Safari → throws "Safari blocked the session cookie" error
5. Checks `if (!res.ok)` → throws error with message
6. Parses JSON and returns `data`

### Error Handling Functions

**File:** `public/app.js`

**Safari Detection:**
- `isSafari()` (lines 1188-1191) - detects Safari browser

**Auth Headers:**
- `getAuthHeaders()` (lines 139-146) - gets token from localStorage and returns header object

**Error Messages:**
- "Safari blocked the session cookie..." (line 1234) - only shown when:
  - `res.status === 401` AND
  - `retryCount >= 5` AND
  - `isSafari() === true`

---

## Findings

### Issue 1: Watch Ad Shows Error Even When Ticket is Granted

**Observation:** Ticket is granted (verified in admin), but Safari shows error popup.

**Possible Causes:**

1. **Response Parsing Failure:**
   - If `res.json()` throws an error (malformed JSON, network interruption), it goes to `.catch()` block
   - The catch block shows `error.message`, which could be the "Safari blocked..." message from a previous retry
   - **However:** The error is thrown before JSON parsing, so this is unlikely

2. **Race Condition:**
   - Multiple retries happening simultaneously
   - One retry succeeds (grants ticket) but another fails and shows error
   - **However:** Retries are sequential, not parallel

3. **Response Status vs JSON Content Mismatch:**
   - Backend returns 200 OK but JSON has `ok: false`
   - Code checks `if (!res.ok)` first (line 1243), which would catch this
   - Then checks `if (data.ok)` in success handler (line 1327)
   - **If backend returns 200 with `{ ok: false }`, the code would throw error**

4. **Network Error After Success:**
   - Request succeeds, ticket granted
   - But network error occurs before response is fully received
   - Goes to catch block
   - **This is most likely** - Safari might be closing connection prematurely

5. **Token Store Cleared:**
   - Token exists when request starts
   - Server restarts, token store cleared
   - Request succeeds (ticket granted) but subsequent requests fail
   - **However:** This wouldn't affect the current request

**Most Likely Root Cause:**
The error message is being shown from a **previous failed retry attempt**, not the final successful one. The code flow suggests:
- Retry 1-4 fail with 401 → log retry message
- Retry 5 succeeds → should show success
- But if there's a network error or JSON parsing issue, it goes to catch block
- The catch block shows the error message, which might be from a previous attempt

**Code Issue:** The error message in the catch block (line 1357) shows `error.message`, which could be from any error, not just the final attempt.

### Issue 2: Wallet Always Shows 0 on Safari

**Observation:** Wallet UI shows 0 for all tiers, but user has tickets in database.

**Possible Causes:**

1. **401 After Retries → Sets Wallet to Zeros:**
   - `loadWallet()` gets 401
   - Retries 5 times, all fail
   - Sets `appState.wallet = { BRONZE: 0, ... }` (line 953)
   - **This is the most likely cause**

2. **Response Missing `ok` or `wallet` Field:**
   - Backend returns 200 but JSON doesn't have `data.ok` or `data.wallet`
   - Code checks `if (data.ok && data.wallet)` (line 989)
   - If false, sets wallet to zeros (line 1001)
   - **Need to verify backend response format**

3. **JSON Parsing Error:**
   - Response is not valid JSON
   - `res.json()` throws error
   - Goes to catch block, sets wallet to zeros (line 1007)
   - **Need to check if Safari is receiving valid JSON**

4. **Token Not in localStorage:**
   - User logged in before token system was implemented
   - No token in localStorage
   - Safari blocks cookies
   - All requests return 401
   - Wallet set to zeros after retries
   - **This is very likely** - users who logged in before token system won't have tokens

5. **Wallet State Not Persisted:**
   - Wallet loads correctly initially
   - But gets reset to zeros somewhere else
   - **Need to check all places that set `appState.wallet`**

**Most Likely Root Cause:**
Users who logged in **before the token system was implemented** don't have tokens in localStorage. On Safari:
- Cookies are blocked (ITP)
- No token in localStorage
- All wallet requests return 401
- After 5 retries, wallet is set to zeros
- User sees 0 tickets even though they have tickets in database

**Secondary Issue:**
Even if token exists, if the server restarted (Railway), the in-memory token store is cleared. The token in localStorage is now invalid, causing 401s.

---

## Root Causes

### Root Cause 1: Token Not Available for Existing Users

**Problem:**
- Token system was added after some users logged in
- These users don't have tokens in localStorage
- Safari blocks cookies, so no fallback
- All authenticated requests return 401
- Frontend sets wallet to zeros after retries

**Evidence:**
- Wallet always shows 0 on Safari
- Tickets are granted (backend works with token/cookie)
- User can see tickets in Chrome (cookies work there)

**Fix Required:**
- Force re-login for Safari users without tokens, OR
- Add token refresh mechanism, OR
- Check for token on page load and prompt re-login if missing

### Root Cause 2: Error Message Shown from Failed Retry

**Problem:**
- Multiple retry attempts log error messages
- If a retry succeeds but then fails (network error, JSON parse error), the catch block shows error
- The error message might be from a previous failed retry, not the current one
- User sees error even though ticket was granted

**Evidence:**
- Ticket is granted (verified in admin)
- But user sees "Safari blocked..." error
- Error message is only thrown on 401 after 5 retries

**Fix Required:**
- Better error handling to distinguish between:
  - Network errors (retry)
  - Auth errors (show Safari message)
  - Success with parsing error (re-fetch wallet)
- Clear error state between retries

### Root Cause 3: In-Memory Token Store Lost on Server Restart

**Problem:**
- Tokens stored in-memory on server
- Railway server restarts → all tokens lost
- Users with tokens in localStorage now have invalid tokens
- Requests return 401
- Frontend doesn't detect invalid token and clear it

**Evidence:**
- Works initially, then stops working after server restart
- Token exists in localStorage but requests fail

**Fix Required:**
- Detect 401 with token → clear invalid token from localStorage
- Prompt user to re-login
- OR: Move token store to persistent storage (Redis/database)

---

## Suggested Fixes

### Fix 1: Detect Missing/Invalid Tokens and Prompt Re-Login

**File:** `public/app.js`

**Change:** Update `loadWallet()` to detect when token is missing/invalid and prompt re-login:

```javascript
async function loadWallet(retryCount = 0) {
  if (!appState.currentUser) return;

  try {
    const headers = getAuthHeaders();
    const hasToken = !!headers['X-Auth-Token'];
    const isSafariBrowser = isSafari();
    
    // Safari FIX: If Safari and no token, prompt re-login
    if (isSafariBrowser && !hasToken) {
      console.warn('[WALLET] Safari user has no token - token system may not have been active when they logged in');
      // Don't set wallet to zeros - show message instead
      const walletGrid = document.getElementById('walletGrid');
      if (walletGrid) {
        walletGrid.innerHTML = '<div class="wallet-error">Please sign out and sign in again to enable Safari support</div>';
      }
      return;
    }
    
    // ... rest of existing code
```

**Also:** Update `callAdRewardsAPI()` with similar check.

### Fix 2: Clear Invalid Tokens on 401

**File:** `public/app.js`

**Change:** When 401 is returned and we have a token, clear it (token is invalid):

```javascript
if (res.status === 401) {
  // Safari FIX: If we sent a token and got 401, token is invalid (server restarted?)
  const hasToken = !!getAuthHeaders()['X-Auth-Token'];
  if (hasToken && retryCount === 0) {
    console.warn('[AUTH] Token invalid - clearing from localStorage');
    localStorage.removeItem('authToken');
    // Retry once without token (will use cookie if available)
    return loadWallet(1);
  }
  
  // ... existing retry logic
}
```

### Fix 3: Better Error Handling in Watch Ad

**File:** `public/app.js`

**Change:** Distinguish between different error types:

```javascript
.catch(error => {
  console.error('[WATCH_AD] Error caught:', error);
  
  // Check if error is from retry logic (Safari cookie message)
  const isSafariCookieError = error.message?.includes('Safari blocked');
  
  // Check if we should re-fetch wallet (might have succeeded despite error)
  if (!isSafariCookieError) {
    // Might be network error - try to reload wallet to see if ticket was granted
    console.log('[WATCH_AD] Non-auth error - checking if ticket was granted...');
    loadWallet().then(() => {
      // If wallet updated, ticket was granted - show success
      const bronzeBefore = appState.currentUser?.credits || 0;
      // Check if bronze increased
      if (appState.wallet?.BRONZE > bronzeBefore) {
        alert('You earned 1 Bronze ticket!');
        return;
      }
    });
  }
  
  // Show error message
  const errorMessage = error.message || 'Something went wrong. Please try again.';
  alert(errorMessage);
  
  // Re-enable button
  watchAdBtn.disabled = false;
  watchAdBtn.textContent = 'Watch ad';
});
```

### Fix 4: Don't Set Wallet to Zeros on 401 - Show Error Instead

**File:** `public/app.js`

**Change:** Instead of silently setting wallet to zeros, show a message:

```javascript
} else {
  console.error('Failed to load wallet after 5 retries - session cookie may not be set (Safari may be blocking cookies)');
  
  // Safari FIX: Don't silently show 0 - show error message
  const walletGrid = document.getElementById('walletGrid');
  if (walletGrid && isSafari()) {
    walletGrid.innerHTML = `
      <div class="wallet-error-message">
        <p>Unable to load wallet. Safari may be blocking cookies.</p>
        <p>Please sign out and sign in again, or try Chrome.</p>
      </div>
    `;
    return;
  }
  
  // For non-Safari, show zeros (graceful degradation)
  appState.wallet = { BRONZE: 0, SILVER: 0, GOLD: 0, EMERALD: 0, SAPPHIRE: 0, RUBY: 0, AMETHYST: 0, DIAMOND: 0 };
  renderWalletGrid();
}
```

### Fix 5: Add Token Refresh on Page Load

**File:** `public/app.js`

**Change:** Check for token on page load and refresh if missing:

```javascript
async function init() {
  // ... existing code
  
  // Safari FIX: Check if user is logged in but has no token (logged in before token system)
  if (appState.currentUser) {
    const token = localStorage.getItem('authToken');
    if (!token && isSafari()) {
      console.warn('[INIT] Safari user logged in but no token - token system may not have been active');
      // Option 1: Force re-login
      // setCurrentUser(null);
      // showScreen('login');
      // Option 2: Try to get token by calling /auth/me (if session cookie works)
      // This will generate a new token if backend supports it
    }
  }
  
  // Check if user is already authenticated
  await checkAuth();
}
```

---

## Testing Recommendations

### Test Scenario 1: New Safari User (Has Token)

1. Clear Safari localStorage
2. Sign in with Google OAuth
3. Verify token is stored: `localStorage.getItem('authToken')`
4. Navigate to My Tickets
5. **Expected:** Wallet loads correctly
6. Tap "Watch Ad"
7. **Expected:** Countdown → Success message → Wallet updates

### Test Scenario 2: Existing Safari User (No Token)

1. User who logged in before token system
2. Open Safari, navigate to My Tickets
3. Check console: `localStorage.getItem('authToken')` should be `null`
4. **Expected:** Should see error message or prompt to re-login
5. Sign out and sign in again
6. **Expected:** Token should be stored, wallet should load

### Test Scenario 3: Server Restart (Token Invalid)

1. User has valid token in localStorage
2. Server restarts (Railway)
3. Navigate to My Tickets
4. **Expected:** Should detect invalid token, clear it, prompt re-login
5. OR: Should fall back to cookie if available

### Test Scenario 4: Network Error During Watch Ad

1. Start "Watch Ad" countdown
2. Simulate network error (disable network mid-request)
3. **Expected:** Should check if ticket was granted before showing error
4. If ticket granted → show success
5. If not → show appropriate error

### Debug Checklist

When testing on Safari, check console for:

1. **Token Status:**
   ```
   localStorage.getItem('authToken')
   ```

2. **Request Headers:**
   - Open Network tab
   - Check `/api/wallet` request
   - Verify `X-Auth-Token` header is present

3. **Response Status:**
   - Check response status code (200, 401, 500, etc.)
   - Check response body JSON

4. **Wallet State:**
   ```
   appState.wallet
   ```

5. **Error Messages:**
   - Look for `[WALLET]` and `[WATCH_AD]` debug logs
   - Check which code path was taken

---

## Implementation Priority

1. **High Priority:** Fix 1 - Detect missing tokens and prompt re-login
2. **High Priority:** Fix 2 - Clear invalid tokens on 401
3. **Medium Priority:** Fix 4 - Don't silently show 0, show error message
4. **Medium Priority:** Fix 3 - Better error handling in Watch Ad
5. **Low Priority:** Fix 5 - Token refresh on page load

---

## Next Steps

1. **Add debug logging** (already done in code)
2. **Test on Safari** with console open to see actual request/response
3. **Implement Fix 1 and Fix 2** (highest impact)
4. **Test with users who logged in before token system**
5. **Monitor for token store issues** (consider moving to Redis)

---

**Last Updated:** November 2024  
**Status:** 🔍 Investigation in progress - debug logging added, fixes ready to implement

