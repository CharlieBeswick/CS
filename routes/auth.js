/**
 * Authentication routes
 * Handles Google OAuth login and session management
 */

const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load Google config (fallback to env vars or defaults for demo)
let googleConfig = {};
const configPath = path.join(__dirname, '..', 'config', 'google.json');
if (fs.existsSync(configPath)) {
  googleConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
  // Use environment variables or placeholder
  googleConfig.clientId = process.env.GOOGLE_CLIENT_ID || 'DEMO_CLIENT_ID';
  googleConfig.clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'DEMO_CLIENT_SECRET';
}

const client = new OAuth2Client(googleConfig.clientId);
const prisma = require('../lib/prisma');
const { adminEmails } = require('../config/admin');
const { createEmptyWallet } = require('../config/tickets');

/**
 * POST /auth/google
 * Receives Google ID token, verifies it, and creates/updates user session
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ ok: false, error: 'Missing credential' });
    }

    // Verify the token with Google
    // Note: In production, you should use the actual client ID
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleConfig.clientId,
    });

    const payload = ticket.getPayload();
    const googleSub = payload.sub;
    const email = payload.email;
    const name = payload.name || email;
    const picture = payload.picture || '';

    // Determine role based on admin email whitelist
    const isAdmin = adminEmails.includes(email);
    const role = isAdmin ? 'ADMIN' : 'PLAYER';
    
    // Log for debugging
    console.log(`[AUTH] User ${email} signing in. Admin whitelist check: ${isAdmin ? 'YES - ADMIN' : 'NO - PLAYER'}`);

    // Check if user exists to preserve publicName/avatarUrl
    const existingUser = await prisma.user.findUnique({
      where: { googleSub },
    });

    // Create or update user record in Prisma
    // IMPORTANT: Always update role on login to ensure admin whitelist changes take effect
    const user = await prisma.user.upsert({
      where: { googleSub },
      update: {
        email,
        name,
        picture,
        role: isAdmin ? 'ADMIN' : (existingUser?.role || 'PLAYER'), // Force ADMIN if in whitelist, otherwise keep existing or default to PLAYER
        // Preserve existing publicName/avatarUrl if set, otherwise use defaults
        publicName: existingUser?.publicName || name,
        avatarUrl: existingUser?.avatarUrl || picture,
      },
      create: {
        googleSub,
        email,
        name,
        picture,
        publicName: name,
        avatarUrl: picture,
        credits: 0, // TODO: Deprecated - keep for backward compat during migration
        ticketWallet: createEmptyWallet(), // Initialize empty 8-tier wallet
        role: isAdmin ? 'ADMIN' : 'PLAYER',
      },
    });
    
    // Double-check: if email is in admin list, ensure role is ADMIN (force update if needed)
    let finalUser = user;
    if (isAdmin && finalUser.role !== 'ADMIN') {
      console.warn(`[AUTH] ⚠️  User ${email} is in admin whitelist but role is ${finalUser.role}. Force updating to ADMIN.`);
      finalUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      console.log(`[AUTH] ✅ Role updated to ADMIN for ${email}`);
    } else if (isAdmin) {
      console.log(`[AUTH] ✅ User ${email} has ADMIN role`);
    }

    // Create session - use Prisma user ID, not Google sub
    req.session.userId = finalUser.id;
    req.session.userEmail = email;
    
    // Track IP address and user agent for security
    const { getClientIp, getUserAgent } = require('../lib/ipHelper');
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    // Record user session with IP address
    try {
      await prisma.userSession.create({
        data: {
          userId: finalUser.id,
          ipAddress,
          userAgent,
        },
      });
      console.log(`[AUTH] 📍 Tracked IP for ${email}: ${ipAddress}`);
    } catch (sessionError) {
      // Don't fail auth if session tracking fails
      console.error('[AUTH] Error tracking user session:', sessionError);
    }
    
    // Explicitly save session
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
      }
    });

    res.json({
      ok: true,
      user: {
        id: finalUser.id,
        email: finalUser.email,
        name: finalUser.name,
        picture: finalUser.picture,
        publicName: finalUser.publicName || finalUser.name,
        avatarUrl: finalUser.avatarUrl || finalUser.picture,
        credits: finalUser.credits,
        role: finalUser.role, // This should now be ADMIN if email is in whitelist
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    
    // If using demo credentials, allow a mock login for testing
    if (googleConfig.clientId === 'DEMO_CLIENT_ID') {
      console.warn('Using demo mode - creating mock user');
      const mockGoogleSub = 'demo-google-sub';
      const mockEmail = 'demo@example.com';
      
      const mockUser = await prisma.user.upsert({
        where: { googleSub: mockGoogleSub },
        update: {},
        create: {
          googleSub: mockGoogleSub,
          email: mockEmail,
          name: 'Demo User',
          picture: '',
          publicName: 'Demo User',
          avatarUrl: '',
          credits: 100, // TODO: Deprecated
          ticketWallet: createEmptyWallet(), // Initialize empty wallet
          role: 'PLAYER',
        },
      });

      req.session.userId = mockUser.id;
      req.session.userEmail = mockUser.email;

      return res.json({
        ok: true,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          picture: mockUser.picture,
          publicName: mockUser.publicName,
          avatarUrl: mockUser.avatarUrl,
          credits: mockUser.credits,
          role: mockUser.role,
        },
        demo: true,
      });
    }
    
    res.status(401).json({ ok: false, error: 'Authentication failed' });
  }
});

/**
 * GET /auth/me
 * Returns the currently authenticated user (if session is valid)
 */
router.get('/me', async (req, res) => {
  if (req.session && req.session.userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
      });
      
      if (user) {
        return res.json({
          ok: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture,
            publicName: user.publicName || user.name,
            avatarUrl: user.avatarUrl || user.picture,
            credits: user.credits,
            role: user.role,
          },
        });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }
  res.json({ ok: false });
});

/**
 * POST /auth/logout
 * Destroys the user session
 */
router.post('/logout', (req, res) => {
  // Clear session data first
  if (req.session) {
    req.session.userId = null;
    req.session.userEmail = null;
  }
  
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ ok: false, error: 'Logout failed' });
    }
    
    // Clear the session cookie
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    
    res.json({ ok: true });
  });
});

module.exports = router;

