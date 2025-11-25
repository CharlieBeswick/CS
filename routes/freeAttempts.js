/**
 * Free Attempts routes
 * Handles daily free mini-game attempts (3 per day, 1/20 chance to win BRONZE)
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { addTickets, getUserWallet } = require('../lib/walletHelpers');
const prisma = require('../lib/prisma');

/**
 * GET /api/free-attempts/status
 * Returns remaining free attempts for today
 * Auth: required
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error('Free attempts status route: req.user is missing');
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const userId = req.user.id;
    
    // Get attempts used today (UTC day)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    
    const attemptsToday = await prisma.freeAttempt.count({
      where: {
        userId: userId,
        createdAt: {
          gte: todayStart,
        },
      },
    });

    const remainingAttempts = Math.max(0, 3 - attemptsToday);

    res.json({
      ok: true,
      remainingAttempts: remainingAttempts,
      usedToday: attemptsToday,
      maxPerDay: 3,
    });
  } catch (error) {
    console.error('Error fetching free attempt status:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch attempt status' });
  }
});

/**
 * POST /api/free-attempts/play
 * Plays a free attempt (1/20 chance to win 1 BRONZE)
 * Auth: required
 * 
 * Enforces server-side limit of 3 attempts per day
 */
router.post('/play', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check attempts used today (UTC day)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    
    const attemptsToday = await prisma.freeAttempt.count({
      where: {
        userId: userId,
        createdAt: {
          gte: todayStart,
        },
      },
    });

    if (attemptsToday >= 3) {
      return res.status(400).json({
        ok: false,
        error: 'No free attempts remaining today.',
        remainingAttempts: 0,
      });
    }

    // Roll for win (1/20 = 5% chance)
    const win = Math.random() < 0.05;
    
    let wallet = null;
    let awarded = null;

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Log the attempt
      const attempt = await tx.freeAttempt.create({
        data: {
          userId: userId,
          didWin: win,
          awardedTier: win ? 'BRONZE' : null,
        },
      });

      // If won, award 1 BRONZE ticket
      if (win) {
        wallet = await addTickets(
          userId,
          'BRONZE',
          1,
          'MINI_GAME_WIN',
          {
            attemptId: attempt.id,
            timestamp: new Date().toISOString(),
          }
        );
        awarded = {
          tier: 'BRONZE',
          amount: 1,
        };
      } else {
        // Get current wallet for response
        wallet = await getUserWallet(userId);
      }
    });

    const remainingAttempts = 3 - (attemptsToday + 1);

    res.json({
      ok: true,
      won: win,
      awarded: awarded,
      remainingAttempts: remainingAttempts,
      wallet: wallet,
    });
  } catch (error) {
    console.error('Error processing free attempt:', error);
    res.status(500).json({ ok: false, error: 'Failed to process free attempt' });
  }
});

module.exports = router;

