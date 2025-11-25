/**
 * Withdrawal Request Routes
 * Handles ticket redemption/withdrawal requests
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const prisma = require('../lib/prisma');
const { consumeTickets, getUserWallet } = require('../lib/walletHelpers');
const { TICKET_TIERS } = require('../config/tickets');

/**
 * POST /api/withdrawal/request
 * Submit a withdrawal request
 * Auth: required
 */
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { tier, btcAddress, solAddress } = req.body;

    // Validate tier
    if (!TICKET_TIERS.includes(tier)) {
      return res.status(400).json({ ok: false, error: 'Invalid ticket tier' });
    }

    // Validate at least one address
    if (!btcAddress && !solAddress) {
      return res.status(400).json({ ok: false, error: 'At least one wallet address (BTC or SOL) is required' });
    }

    // Check user has the ticket
    const wallet = await getUserWallet(req.user.id);
    const balance = wallet[tier] || 0;
    
    if (balance < 1) {
      return res.status(400).json({ ok: false, error: `Insufficient ${tier} tickets. You have ${balance}.` });
    }

    // Create withdrawal request
    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        userId: req.user.id,
        tier: tier,
        amount: 1, // For now, always 1 ticket per request
        btcAddress: btcAddress || null,
        solAddress: solAddress || null,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            publicName: true,
          },
        },
      },
    });

    // Consume the ticket (burn it)
    await consumeTickets(req.user.id, tier, 1, 'WITHDRAWAL_REQUEST', {
      withdrawalRequestId: withdrawal.id,
    });

    res.json({
      ok: true,
      withdrawal: {
        id: withdrawal.id,
        tier: withdrawal.tier,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    res.status(500).json({ ok: false, error: 'Failed to create withdrawal request' });
  }
});

/**
 * GET /api/withdrawal/my-requests
 * Get current user's withdrawal requests
 * Auth: required
 */
router.get('/my-requests', requireAuth, async (req, res) => {
  try {
    const requests = await prisma.withdrawalRequest.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        tier: true,
        amount: true,
        btcAddress: true,
        solAddress: true,
        status: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
      },
    });

    res.json({
      ok: true,
      requests: requests,
    });
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch withdrawal requests' });
  }
});

module.exports = router;

