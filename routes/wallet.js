/**
 * Wallet routes
 * Handles ticket wallet operations
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getUserWallet } = require('../lib/walletHelpers');

/**
 * GET /api/wallet
 * Returns the current user's ticket wallet
 * Auth: required
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error('Wallet route: req.user is missing');
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const wallet = await getUserWallet(req.user.id);
    
    res.json({
      ok: true,
      wallet: wallet,
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch wallet', details: error.message });
  }
});

module.exports = router;

