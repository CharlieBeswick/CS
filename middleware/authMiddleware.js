/**
 * Authentication middleware
 * Checks if the user has a valid session
 * 
 * TODO: In future versions, this can be enhanced with JWT verification
 * or more sophisticated session management
 */

const prisma = require('../lib/prisma');

async function requireAuth(req, res, next) {
  // Debug logging
  if (!req.session) {
    console.log('requireAuth: No session object');
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  
  if (!req.session.userId) {
    console.log('requireAuth: No userId in session', { sessionKeys: Object.keys(req.session || {}) });
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  
  try {
    // Load user from database to attach to request
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
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
  optionalAuth
};

