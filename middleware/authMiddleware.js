/**
 * Authentication middleware
 * Checks if the user has a valid session
 * 
 * Safari FIX: Also supports token-based auth via X-Auth-Token header
 * This is a fallback for Safari users whose cookies are blocked by ITP
 */

const prisma = require('../lib/prisma');
const crypto = require('crypto');

// Token expiry: 24 hours
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Clean up expired tokens from database every hour
setInterval(async () => {
  try {
    const now = new Date();
    const deleted = await prisma.authToken.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });
    if (deleted.count > 0) {
      console.log(`[TOKEN] Cleaned up ${deleted.count} expired tokens from database`);
    }
  } catch (error) {
    console.error('[TOKEN] Error cleaning up expired tokens:', error);
  }
}, 60 * 60 * 1000);

/**
 * Generate a secure token for Safari users
 * Stores token in database for persistence across server restarts
 */
async function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY);
  
  try {
    // Store token in database
    await prisma.authToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
    
    console.log('[TOKEN] Generated new token (database):', {
      userId: userId,
      tokenLength: token.length,
      tokenPreview: token.substring(0, 10) + '...',
      expiresAt: expiresAt.toISOString(),
    });
    
    return token;
  } catch (error) {
    console.error('[TOKEN] ERROR: Failed to store token in database:', error);
    throw error;
  }
}

/**
 * Verify a token and return userId
 * Checks database for token persistence across server restarts
 */
async function verifyToken(token) {
  if (!token) {
    console.log('[TOKEN] verifyToken called with null/undefined token');
    return null;
  }
  
  console.log('[TOKEN] Verifying token (database), length:', token.length, 'preview:', token.substring(0, 10) + '...');
  
  try {
    const authToken = await prisma.authToken.findUnique({
      where: { token },
      include: { user: { select: { id: true } } },
    });
    
    if (!authToken) {
      console.log('[TOKEN] Token not found in database');
      return null;
    }
    
    if (authToken.expiresAt < new Date()) {
      console.log('[TOKEN] Token expired, expiresAt:', authToken.expiresAt.toISOString(), 'now:', new Date().toISOString());
      // Delete expired token
      await prisma.authToken.delete({ where: { id: authToken.id } });
      return null;
    }
    
    console.log('[TOKEN] Token verified successfully (database), userId:', authToken.userId);
    return authToken.userId;
  } catch (error) {
    console.error('[TOKEN] Error verifying token from database:', error);
    return null;
  }
}

async function requireAuth(req, res, next) {
  let userId = null;
  
  // Safari FIX: Check for token header first (Safari fallback)
  const token = req.headers['x-auth-token'];
  if (token) {
    userId = await verifyToken(token);
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

