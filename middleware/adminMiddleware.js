/**
 * Admin middleware
 * Ensures the user is authenticated and has admin privileges
 * 
 * TODO: In future versions:
 * - Add role-based access control (super admin, moderator, etc.)
 * - Add permission levels for different admin actions
 * - Add audit logging
 */

const prisma = require('../lib/prisma');

/**
 * Require admin access
 * Checks if user is authenticated and has ADMIN role
 * Note: This should be called AFTER requireAuth middleware
 */
async function requireAdmin(req, res, next) {
  // requireAuth should have already checked session, but double-check
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  
  try {
    // Load user from database to check role
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, email: true, role: true },
    });
    
    if (!user) {
      console.error('Admin check: User not found', { userId: req.session.userId });
      return res.status(401).json({ ok: false, error: 'User not found' });
    }
    
    // Check if user has ADMIN role
    if (user.role !== 'ADMIN') {
      console.log('Admin check: User is not admin', { email: user.email, role: user.role });
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }
    
    // Attach user to request for convenience
    req.user = user;
    
    // User is admin, proceed
    next();
  } catch (error) {
    console.error('Error checking admin access:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

module.exports = {
  requireAdmin,
};

