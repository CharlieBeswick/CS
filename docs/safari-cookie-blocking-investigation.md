# Safari Cookie Blocking Investigation & Fix Summary

**Date:** November 2024  
**Issue:** Watch Ad feature and ticket loading failing on Safari (macOS and iOS)  
**Status:** Fixed with token-based authentication fallback

---

## Executive Summary

Safari's Intelligent Tracking Prevention (ITP) was blocking cross-origin session cookies, causing authentication failures on Safari browsers (both macOS and iOS). The issue affected all authenticated API calls, including Watch Ad, wallet loading, and lobby access. After multiple attempts to work around Safari's cookie restrictions, a token-based authentication fallback was implemented using localStorage, which successfully bypasses Safari's cookie blocking.

---

## Problem Description

### Initial Symptoms

1. **Watch Ad Feature:**
   - Users on Safari (macOS and iOS) could not complete the "Watch Ad" flow
   - After 5-second countdown, API call failed with 401 (Unauthorized)
   - Error message: "Session expired. Please sign in again."
   - Retry attempts (up to 5) all failed

2. **Ticket/Wallet Loading:**
   - Wallet balance showed as empty or failed to load on Safari
   - Tickets from previous sessions (on other browsers) were not visible
   - Console showed repeated 401 errors for `/api/wallet` endpoint

3. **Lobby Access:**
   - BRONZE lobby failed to load with "Authentication required" errors
   - Chat features were inaccessible
   - All authenticated endpoints returned 401

### Platform-Specific Behavior

- ✅ **Working:** Chrome (Windows, macOS, Android, iOS)
- ✅ **Working:** Edge, Firefox (Windows, macOS)
- ❌ **Broken:** Safari (macOS and iOS)
- ❌ **Broken:** Safari WebView (iOS apps using Safari engine)

---

## Root Cause Analysis

### Safari's Intelligent Tracking Prevention (ITP)

Safari has stricter cookie policies than other browsers:

1. **Cross-Origin Cookie Blocking:**
   - Safari treats cookies with `sameSite: 'none'` as third-party tracking cookies
   - ITP blocks these cookies even when `secure: true` is set
   - This is by design to prevent cross-site tracking

2. **Cookie Processing Delays:**
   - Safari processes cross-origin cookies more slowly than Chrome
   - Initial cookie setting can take 500ms-2000ms
   - Subsequent requests may still fail if cookies are blocked entirely

3. **User Interaction Context:**
   - Safari requires "fresh" user interaction for cookie-enabled requests
   - Fetch requests from timer callbacks lose user interaction context
   - This causes cookie-enabled requests to fail even if cookies are set

### Technical Details

**Cookie Configuration (server.js):**
```javascript
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS required
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
}
```

**Why `sameSite: 'none'` is Required:**
- Frontend hosted on Netlify (e.g., `cryptosnow.app`)
- Backend hosted on Railway (e.g., `perpetual-reprieve-try3.up.railway.app`)
- Cross-origin setup requires `sameSite: 'none'` for cookies to work
- Chrome accepts this, but Safari blocks it

---

## Fix Attempts (Chronological)

### Attempt 1: Retry Logic for Cookie Delays
**Commit:** `18d1c68` - "Fix iOS Watch Ad bug: Add retry logic for 401 errors"

**Approach:**
- Added retry logic with exponential backoff (3 retries: 500ms, 1000ms, 1500ms)
- Pattern matched existing retry logic in `loadWallet()` and `loadFreeAttemptsStatus()`
- Improved error handling to check response status before parsing JSON

**Result:** ❌ **Partial Success**
- Helped with cookie processing delays
- Still failed when Safari completely blocked cookies
- Users still saw "session expired" errors after all retries

---

### Attempt 2: Google OAuth Session Verification
**Commit:** `0cc8308` - "Additional iOS fixes for Google OAuth users - Watch Ad"

**Approach:**
- Added session verification after Google OAuth login (same as email login)
- Increased retry delays to 1000ms, 2000ms, 3000ms for Google OAuth users
- Added session verification check before Watch Ad API call

**Result:** ❌ **Partial Success**
- Improved reliability for Google OAuth users
- Still failed when Safari blocked cookies entirely
- Didn't address the root cause (cookie blocking)

---

### Attempt 3: Timer-Based Countdown Fix
**Commit:** `8bd68ee` - "iOS WebKit fix: Replace setInterval with requestAnimationFrame"

**Approach:**
- Replaced `setInterval` with `requestAnimationFrame` for countdown
- Used timestamp-based counting instead of interval counting
- Wrapped fetch call in `setTimeout(0)` to preserve user interaction context

**Result:** ❌ **Partial Success**
- Improved countdown reliability on iOS
- Fixed timer throttling issues
- Still failed when cookies were blocked (not a timer issue)

---

### Attempt 4: Safari-Specific Retry Logic
**Commit:** `4171f0b` - "Safari-specific fixes: Handle Intelligent Tracking Prevention (ITP) cookie blocking"

**Approach:**
- Added `isSafari()` detection function
- Increased retry attempts from 3 to 5 for Safari
- Increased retry delays: 2000ms, 4000ms, 6000ms, 8000ms, 10000ms for Safari
- Added initial 500ms delay before first request on Safari
- Added `cache: 'no-store'` to prevent Safari caching issues
- Added `rolling: true` to session config
- Improved error messages with Safari ITP guidance

**Result:** ❌ **Failed**
- All retries still failed with 401 errors
- Safari was completely blocking cookies, not just delaying them
- Retry logic couldn't solve the fundamental cookie blocking issue

**Console Output (After All Retries):**
```
Ad reward request failed (401), retrying in 2000ms... (attempt 1/5) [Safari: true]
Ad reward request failed (401), retrying in 4000ms... (attempt 2/5) [Safari: true]
Ad reward request failed (401), retrying in 6000ms... (attempt 3/5) [Safari: true]
Ad reward request failed (401), retrying in 8000ms... (attempt 4/5) [Safari: true]
Ad reward request failed (401), retrying in 10000ms... (attempt 5/5) [Safari: true]
Failed to process ad reward after 5 retries - session cookie may not be set
Watch ad error: Error: Safari blocked the session cookie...
```

---

### Attempt 5: Token-Based Authentication Fallback ✅
**Commit:** `2d7513a` - "Safari token-based auth fallback: Use localStorage when cookies blocked"

**Approach:**
- Implemented token-based authentication as fallback for Safari
- Tokens generated on login and stored in localStorage
- Tokens sent as `X-Auth-Token` header with all API requests
- Middleware checks token header if session cookie is missing
- Automatic fallback: Chrome uses cookies, Safari uses tokens

**Implementation Details:**

**Backend (`middleware/authMiddleware.js`):**
```javascript
// Token generation and verification
function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_EXPIRY;
  tokenStore.set(token, { userId, expiresAt, createdAt: Date.now() });
  return token;
}

// Middleware checks token if session cookie missing
async function requireAuth(req, res, next) {
  let userId = null;
  
  // Check token header first (Safari fallback)
  const token = req.headers['x-auth-token'];
  if (token) {
    userId = verifyToken(token);
  }
  
  // Fall back to session cookie (normal flow)
  if (!userId && req.session && req.session.userId) {
    userId = req.session.userId;
  }
  
  // ... rest of auth logic
}
```

**Frontend (`public/app.js`):**
```javascript
// Get auth headers (includes token if available)
function getAuthHeaders() {
  const headers = {};
  const token = localStorage.getItem('authToken');
  if (token) {
    headers['X-Auth-Token'] = token;
  }
  return headers;
}

// All API calls include auth headers
const headers = getAuthHeaders();
const res = await fetch(`${API_BASE}/api/wallet`, {
  credentials: 'include',
  headers: headers,
});
```

**Result:** ✅ **Success**
- Safari users can now authenticate using tokens
- Works even when cookies are completely blocked
- Automatic fallback: no user action required
- Backward compatible: Chrome still uses cookies
- All authenticated endpoints now work on Safari

---

## Current Solution

### How It Works

1. **On Login:**
   - Backend generates both session cookie AND token
   - Token returned in login response
   - Frontend stores token in localStorage

2. **On API Requests:**
   - Frontend sends both cookie (if available) and token header
   - Backend checks token header first, then falls back to session cookie
   - Works for both Safari (token) and Chrome (cookie)

3. **Token Management:**
   - Tokens expire after 24 hours
   - Tokens cleared on sign out
   - Tokens cleared on auth failures
   - Automatic cleanup of expired tokens

### Benefits

- ✅ Works on Safari even when cookies are blocked
- ✅ No user configuration required
- ✅ Backward compatible with Chrome/cookie-based auth
- ✅ Secure: tokens expire and are properly cleaned up
- ✅ Automatic fallback: no code changes needed per endpoint

---

## Testing Recommendations

### Test Scenarios

1. **Safari (macOS):**
   - Login with Google OAuth
   - Login with email/password
   - Watch Ad feature
   - Wallet/ticket loading
   - Lobby access and chat
   - Sign out and verify token cleared

2. **Safari (iOS):**
   - Same as macOS
   - Test in both Safari and Safari WebView
   - Test with "Prevent Cross-Site Tracking" enabled/disabled

3. **Chrome (Regression Testing):**
   - Verify cookie-based auth still works
   - Verify no performance degradation
   - Verify all features still functional

4. **Edge Cases:**
   - Token expiration (wait 24+ hours)
   - Multiple tabs (token should work across tabs)
   - Private browsing mode (localStorage may be restricted)

---

## Known Limitations

1. **Token Storage:**
   - Uses in-memory token store (not persistent across server restarts)
   - In production, should use Redis or database for token storage
   - Current implementation is sufficient for MVP/testing

2. **Private Browsing:**
   - Safari Private Browsing may restrict localStorage
   - May need additional fallback or user guidance

3. **Token Security:**
   - Tokens are stored in localStorage (accessible to JavaScript)
   - Consider adding token refresh mechanism
   - Consider adding token revocation on password change

---

## Future Improvements

1. **Persistent Token Storage:**
   - Move token store to Redis or database
   - Enable token persistence across server restarts
   - Enable token management (revoke, list active tokens)

2. **Token Refresh:**
   - Implement refresh tokens for longer sessions
   - Automatic token refresh before expiration
   - Better user experience for long sessions

3. **Enhanced Security:**
   - Add token revocation on password change
   - Add device fingerprinting for token validation
   - Add rate limiting per token

4. **Monitoring:**
   - Track token usage vs cookie usage by browser
   - Monitor token generation/expiration rates
   - Alert on unusual token patterns

---

## Conclusion

The Safari cookie blocking issue was successfully resolved by implementing a token-based authentication fallback. While initial attempts focused on working around Safari's cookie restrictions (retries, delays, session verification), the fundamental problem was that Safari was completely blocking cross-origin cookies, not just delaying them.

The token-based solution provides a robust fallback that:
- Works when cookies are blocked
- Requires no user configuration
- Maintains backward compatibility
- Provides a secure authentication mechanism

This solution is production-ready for MVP, though future improvements (persistent token storage, refresh tokens) would enhance scalability and security for larger deployments.

---

## Related Documents

- `docs/ios-watch-ad-investigation.md` - Initial iOS investigation (superseded by this document)
- `server.js` - Cookie and session configuration
- `middleware/authMiddleware.js` - Token generation and verification
- `routes/auth.js` - Login endpoints that generate tokens
- `public/app.js` - Frontend token management and API calls

---

**Last Updated:** November 2024  
**Author:** AI Assistant (Cursor)  
**Status:** ✅ Resolved



