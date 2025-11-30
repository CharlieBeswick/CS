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

// Middleware - CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://crypto-snow.netlify.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://cryptosnow.app',
      'https://www.cryptosnow.app',
    ];
    
    // Check if origin is in allowed list or is a Netlify domain
    if (allowedOrigins.includes(origin) || /\.netlify\.app$/.test(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Health check - MUST be early for Railway health checks
// Keep it simple and fast - Railway needs this to pass
app.get('/api/health', (req, res) => {
  // Log health check requests so we can see if Railway is hitting it
  console.log(`[HEALTH] Health check requested at ${new Date().toISOString()}`);
  // No middleware, no database calls, just respond immediately
  res.status(200).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    port: PORT,
    pid: process.pid,
    uptime: process.uptime()
  }));
});

// Root path for Railway health checks - respond immediately
app.get('/', (req, res) => {
  console.log(`[ROOT] Root endpoint requested at ${new Date().toISOString()}`);
  res.status(200).json({ 
    ok: true, 
    service: 'Crypto Snow API', 
    status: 'running',
    timestamp: new Date().toISOString(),
    port: PORT,
    pid: process.pid
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
// Safari FIX: Safari's Intelligent Tracking Prevention (ITP) blocks cross-origin cookies aggressively
// We need explicit sameSite: 'none' and secure: true for cross-origin cookies
app.use(session({
  secret: process.env.SESSION_SECRET || 'crypto-tickets-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    // Safari FIX: Use 'none' for cross-origin cookies (Netlify frontend + Railway backend)
    // Safari requires explicit 'none' + 'secure' for cross-origin cookies
    // 'lax' only works for same-site cookies and will be blocked by Safari ITP
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    // Safari FIX: Don't set domain explicitly - let browser handle it
    // Setting domain explicitly can cause Safari to reject the cookie
    // path: '/' is implicit, which is correct for cross-origin
  },
  // Safari FIX: Ensure session is saved even if not modified
  // This helps Safari recognize the session cookie
  rolling: true, // Reset expiration on every request
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

// Admin app - serve HTML (auth check happens in admin.js client-side)
// This allows the HTML to load even if cookies aren't sent (e.g., from Netlify redirect)
// The admin.js will check auth and show appropriate message if not authenticated
app.get('/admin', (req, res) => {
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
// Listen on 0.0.0.0 to accept connections from Railway's proxy
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Crypto Tickets server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Server is listening and ready to accept connections`);
  console.log(`✅ Health check available at http://0.0.0.0:${PORT}/api/health`);
  console.log(`✅ Root endpoint available at http://0.0.0.0:${PORT}/`);
  console.log(`✅ Process PID: ${process.pid}`);
  console.log(`✅ Railway PORT env: ${process.env.PORT || 'not set'}`);
  console.log(`Make sure to configure Google OAuth credentials in config/google.json`);
  console.log(`Or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables`);
  
  // Initialize lobbies after server starts (non-blocking)
  initializeAllLobbies().catch(err => {
    console.error('Error initializing lobbies:', err);
    console.log('Server is running, but lobbies may not be initialized. This is OK for first startup.');
  });
  
  // Keep process alive - log every 30 seconds to prove we're running
  setInterval(() => {
    console.log(`[${new Date().toISOString()}] Server is still running on port ${PORT}`);
  }, 30000);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Unexpected server error:', err);
  }
  process.exit(1);
});

// Handle process errors - log but don't exit immediately in production
// Railway will restart on failure, but we want to log errors first
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  // Give Railway time to see the error before exiting
  setTimeout(() => {
    console.error('Exiting due to uncaught exception');
    process.exit(1);
  }, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Log but don't exit - many unhandled rejections are non-fatal
  // Only exit if it's a critical error
  if (reason && reason.code === 'ECONNREFUSED') {
    console.error('Database connection refused - this is critical');
    setTimeout(() => process.exit(1), 5000);
  }
});

