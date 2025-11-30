/**
 * Authentication routes
 * Handles Google OAuth login and session management
 */

const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');
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
    // Safari FIX: Accept credential from either JSON body or form-encoded body
    const credential = req.body.credential;

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

    // Safari FIX: Generate token for Safari users (fallback when cookies are blocked)
    const { generateToken } = require('../middleware/authMiddleware');
    const authToken = generateToken(finalUser.id);

    // Safari FIX: Redirect to first-party frontend page to store token in localStorage
    // This works around Safari's cross-origin localStorage restrictions
    // Token is stored on cryptosnow.app domain, not in OAuth popup or backend domain
    const frontendUrl = process.env.FRONTEND_URL || 'https://cryptosnow.app';
    const redirectUrl = `${frontendUrl}/auth-complete?token=${encodeURIComponent(authToken)}`;
    
    console.log(`[AUTH] Google OAuth success for ${email}, redirecting to:`, redirectUrl.substring(0, 100) + '...');
    console.log(`[AUTH] Token being sent in redirect (first 20 chars):`, authToken.substring(0, 20));
    
    res.redirect(302, redirectUrl);
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
 * POST /auth/register
 * Creates a new user account with email/password
 */
router.post('/register', async (req, res) => {
  try {
    // Safari FIX: Accept data from either JSON body or form-encoded body
    const email = req.body.email;
    const password = req.body.password;
    const fullName = req.body.fullName;
    const dateOfBirth = req.body.dateOfBirth;

    // Validation
    if (!email || !password || !fullName || !dateOfBirth) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email, password, full name, and date of birth are required' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }

    // Password validation (minimum 8 characters)
    if (password.length < 8) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Age calculation
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Age verification (must be 13+)
    if (age < 13) {
      return res.status(400).json({ 
        ok: false, 
        error: 'You must be at least 13 years old to register' 
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ 
        ok: false, 
        error: 'An account with this email already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        name: fullName, // Also set name for compatibility
        publicName: fullName,
        dateOfBirth: birthDate,
        age,
        ticketWallet: createEmptyWallet(),
        role: adminEmails.includes(email.toLowerCase()) ? 'ADMIN' : 'PLAYER',
      },
    });

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    // Track IP and user agent
    const { getClientIp, getUserAgent } = require('../lib/ipHelper');
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress: ip,
        userAgent: userAgent,
        lastSeenAt: new Date(),
      },
    });

    // Safari FIX: Generate token and redirect to first-party frontend page
    const { generateToken } = require('../middleware/authMiddleware');
    const authToken = generateToken(user.id);

    const frontendUrl = process.env.FRONTEND_URL || 'https://cryptosnow.app';
    const redirectUrl = `${frontendUrl}/auth-complete?token=${encodeURIComponent(authToken)}`;
    
    console.log(`[AUTH] Login success for ${user.email}, redirecting to:`, redirectUrl.substring(0, 100) + '...');
    console.log(`[AUTH] Token being sent in redirect (first 20 chars):`, authToken.substring(0, 20));
    
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ ok: false, error: 'Registration failed' });
  }
});

/**
 * POST /auth/login
 * Authenticates user with email/password
 */
router.post('/login', async (req, res) => {
  try {
    // Safari FIX: Accept data from either JSON body or form-encoded body
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Invalid email or password' 
      });
    }

    // Check if user has a password (email/password account)
    if (!user.passwordHash) {
      return res.status(401).json({ 
        ok: false, 
        error: 'This account was created with Google Sign-In. Please use Google to sign in.' 
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Invalid email or password' 
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    // Track IP and user agent
    const { getClientIp, getUserAgent } = require('../lib/ipHelper');
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress: ip,
        userAgent: userAgent,
        lastSeenAt: new Date(),
      },
    });

    // Safari FIX: Generate token and redirect to first-party frontend page
    const { generateToken } = require('../middleware/authMiddleware');
    const authToken = generateToken(user.id);

    const frontendUrl = process.env.FRONTEND_URL || 'https://cryptosnow.app';
    const redirectUrl = `${frontendUrl}/auth-complete?token=${encodeURIComponent(authToken)}`;
    
    console.log(`[AUTH] Login success for ${user.email}, redirecting to:`, redirectUrl.substring(0, 100) + '...');
    console.log(`[AUTH] Token being sent in redirect (first 20 chars):`, authToken.substring(0, 20));
    
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

/**
 * POST /auth/register
 * Creates a new user account with email/password
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, dateOfBirth } = req.body;

    // Validation
    if (!email || !password || !fullName || !dateOfBirth) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email, password, full name, and date of birth are required' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }

    // Password validation (minimum 8 characters)
    if (password.length < 8) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Age calculation
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Age verification (must be 13+)
    if (age < 13) {
      return res.status(400).json({ 
        ok: false, 
        error: 'You must be at least 13 years old to register' 
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ 
        ok: false, 
        error: 'An account with this email already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        name: fullName, // Also set name for compatibility
        publicName: fullName,
        dateOfBirth: birthDate,
        age,
        ticketWallet: createEmptyWallet(),
        role: adminEmails.includes(email.toLowerCase()) ? 'ADMIN' : 'PLAYER',
      },
    });

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    // Track IP and user agent
    const { getClientIp, getUserAgent } = require('../lib/ipHelper');
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress: ip,
        userAgent: userAgent,
        lastSeenAt: new Date(),
      },
    });

    // Safari FIX: Generate token and redirect to first-party frontend page
    const { generateToken } = require('../middleware/authMiddleware');
    const authToken = generateToken(user.id);

    const frontendUrl = process.env.FRONTEND_URL || 'https://cryptosnow.app';
    const redirectUrl = `${frontendUrl}/auth-complete?token=${encodeURIComponent(authToken)}`;
    
    console.log(`[AUTH] Login success for ${user.email}, redirecting to:`, redirectUrl.substring(0, 100) + '...');
    console.log(`[AUTH] Token being sent in redirect (first 20 chars):`, authToken.substring(0, 20));
    
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ ok: false, error: 'Registration failed' });
  }
});

/**
 * POST /auth/login
 * Authenticates user with email/password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Invalid email or password' 
      });
    }

    // Check if user has a password (email/password account)
    if (!user.passwordHash) {
      return res.status(401).json({ 
        ok: false, 
        error: 'This account was created with Google Sign-In. Please use Google to sign in.' 
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Invalid email or password' 
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    // Track IP and user agent
    const { getClientIp, getUserAgent } = require('../lib/ipHelper');
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress: ip,
        userAgent: userAgent,
        lastSeenAt: new Date(),
      },
    });

    // Safari FIX: Generate token and redirect to first-party frontend page
    const { generateToken } = require('../middleware/authMiddleware');
    const authToken = generateToken(user.id);

    const frontendUrl = process.env.FRONTEND_URL || 'https://cryptosnow.app';
    const redirectUrl = `${frontendUrl}/auth-complete?token=${encodeURIComponent(authToken)}`;
    
    console.log(`[AUTH] Login success for ${user.email}, redirecting to:`, redirectUrl.substring(0, 100) + '...');
    console.log(`[AUTH] Token being sent in redirect (first 20 chars):`, authToken.substring(0, 20));
    
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

/**
 * GET /auth/me
 * Returns the currently authenticated user (if session or token is valid)
 * Safari FIX: Also checks X-Auth-Token header for Safari users
 */
router.get('/me', async (req, res) => {
  let userId = null;
  
  // Safari FIX: Check for token header first (Safari fallback)
  const { verifyToken } = require('../middleware/authMiddleware');
  const token = req.headers['x-auth-token'];
  
  console.log('[AUTH] /me called:', {
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    tokenPreview: token ? token.substring(0, 10) + '...' : null,
    hasSession: !!req.session,
    sessionUserId: req.session?.userId,
  });
  
  if (token) {
    userId = verifyToken(token);
    if (userId) {
      console.log('[AUTH] /me: Using token-based auth (Safari fallback), userId:', userId);
    } else {
      console.log('[AUTH] /me: Token provided but verification failed - token not found in store or expired');
    }
  }
  
  // Fall back to session cookie (normal flow for Chrome, etc.)
  if (!userId && req.session && req.session.userId) {
    userId = req.session.userId;
    console.log('[AUTH] /me: Using session cookie auth, userId:', userId);
  }
  
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (user) {
        console.log('[AUTH] /me: User found, returning user data for:', user.email);
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
      } else {
        console.log('[AUTH] /me: User not found in database for userId:', userId);
      }
    } catch (error) {
      console.error('[AUTH] /me: Error fetching user:', error);
    }
  } else {
    console.log('[AUTH] /me: No valid userId found - returning ok: false');
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

