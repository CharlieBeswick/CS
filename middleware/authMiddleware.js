/**
 * Authentication middleware
 * Checks if the user has a valid session
 * 
 * Safari FIX: Also supports token-based auth via X-Auth-Token header
 * This is a fallback for Safari users whose cookies are blocked by ITP
 */

const prisma = require('../lib/prisma');
const crypto = require('crypto');

// In-memory token store (in production, use Redis or database)
// Format: { token: { userId, expiresAt, createdAt } }
const tokenStore = new Map();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(token);
    }
  }
}, 60 * 60 * 1000);

/**
 * Generate a secure token for Safari users
 */
function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_EXPIRY;
  tokenStore.set(token, { userId, expiresAt, createdAt: Date.now() });
  return token;
}

/**
 * Verify a token and return userId
 */
function verifyToken(token) {
  if (!token) {
    console.log('[TOKEN] verifyToken called with null/undefined token');
    return null;
  }
  
  console.log('[TOKEN] Verifying token, length:', token.length, 'preview:', token.substring(0, 10) + '...');
  console.log('[TOKEN] Token store size:', tokenStore.size);
  
  const data = tokenStore.get(token);
  if (!data) {
    console.log('[TOKEN] Token not found in store');
    // Log first few tokens in store for debugging (don't log full tokens for security)
    if (tokenStore.size > 0) {
      const sampleTokens = Array.from(tokenStore.keys()).slice(0, 3);
      console.log('[TOKEN] Sample tokens in store (first 10 chars):', sampleTokens.map(t => t.substring(0, 10) + '...'));
    }
    return null;
  }
  
  if (data.expiresAt < Date.now()) {
    console.log('[TOKEN] Token expired, expiresAt:', new Date(data.expiresAt).toISOString(), 'now:', new Date().toISOString());
    tokenStore.delete(token);
    return null;
  }
  
  console.log('[TOKEN] Token verified successfully, userId:', data.userId);
  return data.userId;
}

async function requireAuth(req, res, next) {
  let userId = null;
  
  // Safari FIX: Check for token header first (Safari fallback)
  const token = req.headers['x-auth-token'];
  if (token) {
    userId = verifyToken(token);
    if (userId) {
      console.log('requireAuth: Using token-based auth (Safari fallback)');
    }
  }
  
  // Fall back to session cookie (normal flow for Chrome, etc.)
  if (!userId && req.session && req.session.userId) {
    userId = req.session.userId;
    console.log('requireAuth: Using session cookie auth');
  }
  
  if (!userId) {
    console.log('requireAuth: No valid auth found', { 
      hasToken: !!token, 
      hasSession: !!req.session,
      sessionUserId: req.session?.userId 
    });
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  
  try {
    // Load user from database to attach to request
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    
    if (!user) {
      return res.status(401).json({ ok: false, error: 'User not found' });
    }
    
    // Attach user to request for convenience
    req.user = user;
    next();
  } catch (error) {
    console.error('Error loading user in requireAuth:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

function optionalAuth(req, res, next) {
  // Always allow, but attach user info if available
  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  generateToken,
  verifyToken,
};

