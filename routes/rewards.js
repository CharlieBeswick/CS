/**
 * Rewards routes
 * Handles ticket rewards (ad rewards, etc.)
 * 
 * TODO: In future versions:
 * - Validate signed token/receipt from real ad network (AdMob, etc.)
 * - Add abuse/rate-limit protection
 * - Add daily limits per reward type
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { addTickets } = require('../lib/walletHelpers');

/**
 * POST /api/rewards/ad
 * Awards 1 BRONZE ticket for a confirmed ad view
 * Auth: required
 * 
 * TODO: This endpoint must later validate a signed token/receipt from the real ad network.
 * TODO: Add abuse/rate-limit protection once ad integration is real.
 */
router.post('/ad', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Award 1 BRONZE ticket
    const wallet = await addTickets(
      userId,
      'BRONZE',
      1,
      'AD_REWARD',
      {
        timestamp: new Date().toISOString(),
        // TODO: Add ad network receipt/token validation here
      }
    );

    res.json({
      ok: true,
      tier: 'BRONZE',
      amount: 1,
      wallet: wallet,
    });
  } catch (error) {
    console.error('Error processing ad reward:', error);
    res.status(500).json({ ok: false, error: 'Failed to process ad reward' });
  }
});

module.exports = router;

