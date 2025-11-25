/**
 * Admin Configuration
 * Email whitelist for admin access
 * 
 * TODO: In future versions:
 * - Move to database with role-based access control
 * - Add admin roles (super admin, moderator, etc.)
 * - Add audit logging for admin actions
 */

module.exports = {
  adminEmails: [
    'cmbict@gmail.com', // TODO: adjust as needed
  ],
};

