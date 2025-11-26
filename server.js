/**
 * Crypto Tickets - Express Server
 * Main entry point for the backend
 */

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const tombolaRoutes = require('./routes/tombolas');
const profileRoutes = require('./routes/profile');
const ticketsRoutes = require('./routes/tickets');
const boardRoutes = require('./routes/board');
const drawRoutes = require('./routes/draw');
const adminRoutes = require('./routes/admin');
const historyRoutes = require('./routes/history');
const walletRoutes = require('./routes/wallet');
const lobbyRoutes = require('./routes/lobbies');
const rewardsRoutes = require('./routes/rewards');
const freeAttemptsRoutes = require('./routes/freeAttempts');
const withdrawalRoutes = require('./routes/withdrawal');
const { requireAuth } = require('./middleware/authMiddleware');
const { requireAdmin } = require('./middleware/adminMiddleware');
const { initializeAllLobbies } = require('./lib/lobbyService');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy to get real IP addresses (important for IP tracking)
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: [
    'https://crypto-snow.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    /\.netlify\.app$/, // Allow all Netlify preview deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'crypto-tickets-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  },
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Admin app - serve static assets (before API routes to avoid conflicts)
app.use('/admin-assets', express.static(path.join(__dirname, 'admin')));

// API Routes
app.use('/auth', authRoutes);
// Draw routes must come first (most specific)
app.use('/api/tombolas', drawRoutes); // Draw routes: /api/tombolas/:id/draw
// Board routes come before tombola routes to avoid conflicts
app.use('/api/tombolas', boardRoutes); // Board routes: /api/tombolas/:id/board and /api/tombolas/:id/enter
app.use('/api/tombolas', tombolaRoutes); // Tombola routes: /api/tombolas and /api/tombolas/:id
app.use('/api/profile', profileRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/wallet', walletRoutes); // Wallet routes: /api/wallet
app.use('/api/rewards', rewardsRoutes); // Reward routes: /api/rewards/ad
app.use('/api/free-attempts', freeAttemptsRoutes); // Free attempts: /api/free-attempts/play
app.use('/api/withdrawal', withdrawalRoutes); // Withdrawal routes: /api/withdrawal/request, /api/withdrawal/my-requests
app.use('/api/admin', adminRoutes); // Admin routes: /api/admin/tombolas
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/history', historyRoutes);

// Admin app - serve HTML (requires admin access) - must come before catch-all route
app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Debug endpoint to check session (remove in production)
app.get('/admin/debug-session', (req, res) => {
  res.json({
    hasSession: !!req.session,
    sessionKeys: req.session ? Object.keys(req.session) : [],
    userId: req.session?.userId,
    userEmail: req.session?.userEmail,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Route test endpoint (for debugging)
app.get('/api/test-routes', (req, res) => {
  res.json({
    ok: true,
    message: 'Server is running',
    routes: {
      wallet: '/api/wallet',
      freeAttempts: '/api/free-attempts/status',
      rewards: '/api/rewards/ad',
    },
    timestamp: new Date().toISOString(),
  });
});

// Serve index.html for all non-API routes (SPA routing)
app.get('*', (req, res) => {
  // Don't serve HTML for API routes or admin routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/admin')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// Start server first (don't block on lobby initialization)
app.listen(PORT, () => {
  console.log(`Crypto Tickets server running on http://localhost:${PORT}`);
  console.log(`Make sure to configure Google OAuth credentials in config/google.json`);
  console.log(`Or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables`);
  
  // Initialize lobbies after server starts (non-blocking)
  initializeAllLobbies().catch(err => {
    console.error('Error initializing lobbies:', err);
    console.log('Server is running, but lobbies may not be initialized. This is OK for first startup.');
  });
});

