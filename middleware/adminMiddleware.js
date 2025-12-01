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
  // requireAuth should have already checked auth (session or token) and set req.user
  // Safari FIX: Check req.user first (set by requireAuth for both session and token auth)
  if (!req.user) {
    // If req.user is not set, requireAuth didn't authenticate the user
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  
  // req.user is already set by requireAuth, just check the role
  // Check if user has ADMIN role
  if (req.user.role !== 'ADMIN') {
    console.log('Admin check: User is not admin', { email: req.user.email, role: req.user.role });
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  
  // User is admin, proceed
  next();
}

module.exports = {
  requireAdmin,
};

