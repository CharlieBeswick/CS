/**
 * Admin API routes
 * Handles admin-only operations for managing tombolas
 * 
 * TODO: In future versions:
 * - Add role-based permissions (super admin, moderator, etc.)
 * - Add audit logging for all admin actions
 * - Add bulk operations
 * - Add export/import functionality
 * - Add scheduling system for automatic status changes
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const prisma = require('../lib/prisma');
const { listLobbiesForAdmin, getLobbyForAdmin } = require('../lib/lobbyService');
const { listGameHistory, getGameHistory } = require('../lib/historyService');
const { addTickets } = require('../lib/walletHelpers');

// All admin routes require both auth and admin access
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/tombolas
 * Returns all tombolas for admin management with enhanced data:
 * - Ticket counts per tombola
 * - Draw information (winner, time won, payouts) for finished games
 * - Current lobby status
 */
router.get('/tombolas', async (req, res) => {
  try {
    const tombolas = await prisma.tombola.findMany({
      include: {
        tickets: {
          select: { id: true },
        },
        draws: {
          where: {
            status: 'FINISHED',
          },
          include: {
            winnerUser: {
              select: {
                id: true,
                publicName: true,
                email: true,
              },
            },
            winnerTicket: {
              select: {
                id: true,
                number: true,
              },
            },
          },
          orderBy: {
            finishedAt: 'desc',
          },
          take: 1, // Get most recent draw
        },
      },
      orderBy: [
        { status: 'asc' }, // LIVE first, then PENDING, then FINISHED
        { updatedAt: 'desc' },
      ],
    });
    
    // Enrich tombolas with ticket counts and draw info
    const enrichedTombolas = tombolas.map(tombola => {
      const ticketCount = tombola.tickets.length;
      const latestDraw = tombola.draws[0] || null;
      
      const enriched = {
        ...tombola,
        ticketCount: ticketCount,
        draw: latestDraw ? {
          id: latestDraw.id,
          finishedAt: latestDraw.finishedAt,
          potSize: latestDraw.potSize,
          winnerPayout: latestDraw.winnerPayout,
          housePayout: latestDraw.housePayout,
          winner: latestDraw.winnerUser ? {
            id: latestDraw.winnerUser.id,
            publicName: latestDraw.winnerUser.publicName || 'Anonymous',
            email: latestDraw.winnerUser.email,
          } : null,
          winnerTicket: latestDraw.winnerTicket ? {
            id: latestDraw.winnerTicket.id,
            number: latestDraw.winnerTicket.number,
          } : null,
        } : null,
      };
      
      // Remove relations from response (we've extracted what we need)
      delete enriched.tickets;
      delete enriched.draws;
      
      return enriched;
    });
    
    res.json({
      ok: true,
      tombolas: enrichedTombolas,
    });
  } catch (error) {
    console.error('Error fetching tombolas:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch tombolas' });
  }
});

router.get('/lobbies', async (req, res) => {
  try {
    const { tier, status, days } = req.query;
    const lobbies = await listLobbiesForAdmin({
      tier: tier ? tier.toUpperCase() : undefined,
      status: status ? status.toUpperCase() : undefined,
      days: days ? parseInt(days, 10) : undefined,
    });
    res.json({ ok: true, lobbies });
  } catch (error) {
    console.error('Error fetching lobbies:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch lobbies' });
  }
});

router.get('/lobbies/:id', async (req, res) => {
  try {
    const lobby = await getLobbyForAdmin(req.params.id);
    if (!lobby) {
      return res.status(404).json({ ok: false, error: 'Lobby not found' });
    }
    res.json({ ok: true, lobby });
  } catch (error) {
    console.error('Error fetching lobby detail:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch lobby detail' });
  }
});

/**
 * POST /api/admin/tombolas
 * Creates a new tombola
 */
router.post('/tombolas', async (req, res) => {
  try {
    const { name, prize, status, description, houseCutRatio, startTime, endTime } = req.body;
    
    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'Name is required' });
    }
    
    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    
    // Check for slug collisions
    let finalSlug = slug;
    let counter = 1;
    while (await prisma.tombola.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }
    
    // Validate status
    const validStatuses = ['DRAFT', 'LIVE', 'PENDING', 'FINISHED'];
    const finalStatus = status && validStatuses.includes(status) ? status : 'DRAFT';
    
    // Validate houseCutRatio
    const finalHouseCutRatio = houseCutRatio !== undefined 
      ? Math.max(0, Math.min(0.9, houseCutRatio)) 
      : 0.2;
    
    // Create tombola
    const tombola = await prisma.tombola.create({
      data: {
        slug: finalSlug,
        name: name.trim(),
        prize: prize || '',
        description: description || null,
        status: finalStatus,
        houseCutRatio: finalHouseCutRatio,
        startTime: startTime || null,
        endTime: endTime || null,
      },
    });
    
    res.json({
      ok: true,
      tombola: tombola,
    });
  } catch (error) {
    console.error('Error creating tombola:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to create tombola' });
  }
});

/**
 * PUT /api/admin/tombolas/:id
 * Updates an existing tombola
 */
router.put('/tombolas/:id', async (req, res) => {
  try {
    const { name, prize, status, description, houseCutRatio, startTime, endTime } = req.body;
    const tombolaId = req.params.id;
    
    // Check tombola exists
    const existing = await prisma.tombola.findUnique({
      where: { id: tombolaId },
    });
    
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Tombola not found' });
    }
    
    // Build update data
    const updateData = {};
    
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (prize !== undefined) {
      updateData.prize = prize;
    }
    if (status !== undefined) {
      const validStatuses = ['DRAFT', 'LIVE', 'PENDING', 'FINISHED'];
      if (validStatuses.includes(status)) {
        updateData.status = status;
      }
    }
    if (description !== undefined) {
      updateData.description = description || null;
    }
    if (houseCutRatio !== undefined) {
      updateData.houseCutRatio = Math.max(0, Math.min(0.9, houseCutRatio));
    }
    if (startTime !== undefined) {
      updateData.startTime = startTime || null;
    }
    if (endTime !== undefined) {
      updateData.endTime = endTime || null;
    }
    
    // Update tombola
    const tombola = await prisma.tombola.update({
      where: { id: tombolaId },
      data: updateData,
    });
    
    res.json({
      ok: true,
      tombola: tombola,
    });
  } catch (error) {
    console.error('Error updating tombola:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to update tombola' });
  }
});

/**
 * PUT /api/admin/tombolas/:id/timer
 * Updates timer settings for a tombola (extend time if lobby not filled)
 */
router.put('/tombolas/:id/timer', async (req, res) => {
  try {
    const tombolaId = req.params.id;
    const { extendMinutes, autoStart } = req.body;
    
    // Check tombola exists
    const tombola = await prisma.tombola.findUnique({
      where: { id: tombolaId },
    });
    
    if (!tombola) {
      return res.status(404).json({ ok: false, error: 'Tombola not found' });
    }
    
    const updateData = {};
    
    // Extend end time by specified minutes
    if (extendMinutes && typeof extendMinutes === 'number' && extendMinutes > 0) {
      const currentEndTime = tombola.endTime ? new Date(tombola.endTime) : new Date();
      currentEndTime.setMinutes(currentEndTime.getMinutes() + extendMinutes);
      updateData.endTime = currentEndTime;
    }
    
    // Auto-start logic (if autoStart is true and lobby is filled)
    if (autoStart === true) {
      const ticketCount = await prisma.ticket.count({
        where: { tombolaId },
      });
      
      // For now, just update status to LIVE if there are tickets
      // TODO: Implement proper auto-start logic based on queue size
      if (ticketCount > 0 && tombola.status === 'PENDING') {
        updateData.status = 'LIVE';
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid timer update provided' });
    }
    
    const updated = await prisma.tombola.update({
      where: { id: tombolaId },
      data: updateData,
    });
    
    res.json({
      ok: true,
      tombola: updated,
    });
  } catch (error) {
    console.error('Error updating timer:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to update timer' });
  }
});

/**
 * DELETE /api/admin/tombolas/:id
 * Deletes a tombola (only if no tickets exist)
 * 
 * TODO: Implement soft delete instead of hard delete
 * TODO: Add archive functionality
 */
router.delete('/tombolas/:id', async (req, res) => {
  try {
    const tombolaId = req.params.id;
    
    // Check if tombola exists
    const tombola = await prisma.tombola.findUnique({
      where: { id: tombolaId },
      include: {
        tickets: {
          select: { id: true },
          take: 1,
        },
      },
    });
    
    if (!tombola) {
      return res.status(404).json({ ok: false, error: 'Tombola not found' });
    }
    
    // Check if tickets exist
    if (tombola.tickets.length > 0) {
      return res.status(400).json({ ok: false, error: 'Cannot delete tombola with existing tickets' });
    }
    
    // Delete tombola
    await prisma.tombola.delete({
      where: { id: tombolaId },
    });
    
    res.json({
      ok: true,
    });
  } catch (error) {
    console.error('Error deleting tombola:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to delete tombola' });
  }
});

/**
 * GET /api/admin/summary
 * Returns dashboard summary statistics
 * Auth: required, Admin only
 */
router.get('/summary', async (req, res) => {
  try {
    // Total registered users
    const totalUsers = await prisma.user.count();
    
    // Total games run (from GameHistory)
    const totalGames = await prisma.gameHistory.count();
    
    // Total ads viewed (from CreditTransaction with AD_REWARD reason)
    const totalAdsViewed = await prisma.creditTransaction.count({
      where: { reason: 'AD_REWARD' },
    });
    
    // Live players (logged in less than 10 minutes ago)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentSessions = await prisma.userSession.findMany({
      where: {
        lastSeenAt: {
          gte: tenMinutesAgo,
        },
      },
      select: { userId: true },
    });
    const livePlayers = new Set(recentSessions.map(s => s.userId)).size;
    
    // TODO: Active lobbies - replace with real queue count once TierGameQueue model is implemented
    const activeLobbies = 0; // Stub: queues not yet implemented
    
    // Total tickets issued (aggregate from all user wallets)
    const users = await prisma.user.findMany({
      select: {
        ticketWallet: true,
      },
    });
    
    const totalTicketsIssued = {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      EMERALD: 0,
      SAPPHIRE: 0,
      RUBY: 0,
      AMETHYST: 0,
      DIAMOND: 0,
    };
    
    users.forEach(user => {
      if (user.ticketWallet && typeof user.ticketWallet === 'object') {
        Object.keys(totalTicketsIssued).forEach(tier => {
          const balance = user.ticketWallet[tier] || 0;
          if (typeof balance === 'number') {
            totalTicketsIssued[tier] += balance;
          }
        });
      }
    });
    
    res.json({
      ok: true,
      totalGames,
      totalAdsViewed,
      totalPlayers: totalUsers,
      livePlayers,
      ticketCounts: totalTicketsIssued,
    });
  } catch (error) {
    console.error('Error fetching admin summary:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch summary' });
  }
});

/**
 * GET /api/admin/games
 * Returns recent completed games
 * Query params: limit (default 50)
 * Auth: required, Admin only
 */
router.get('/games', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // Get recent finished draws
    const draws = await prisma.draw.findMany({
      where: {
        status: 'FINISHED',
      },
      include: {
        tombola: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        winnerUser: {
          select: {
            id: true,
            publicName: true,
            email: true,
          },
        },
        winnerTicket: {
          select: {
            id: true,
            number: true,
          },
        },
      },
      orderBy: {
        finishedAt: 'desc',
      },
      take: limit,
    });
    
    // Format games for response
    const games = draws.map(draw => {
      // Determine tier from tombola name or use placeholder
      // TODO: Once tier queue system is implemented, store tier in Draw model
      const tier = 'BRONZE'; // Placeholder - will be replaced with real tier from queue system
      const queueSize = draw.potSize || 20; // Use potSize as proxy for queue size
      
      return {
        id: draw.id,
        gameId: draw.id,
        dateTime: draw.finishedAt?.toISOString() || draw.startedAt.toISOString(),
        tier: tier, // TODO: Get from queue/tier system once implemented
        queueSize: queueSize, // TODO: Get from queue system
        winner: draw.winnerUser?.publicName || draw.winnerUser?.email || 'Anonymous',
        winnerId: draw.winnerUserId,
        rewardAmount: 1, // TODO: Get from queue config (1/2/3 based on queue size)
        potSize: draw.potSize || 0,
        winnerPayout: draw.winnerPayout || 0,
      };
    });
    
    res.json({
      ok: true,
      games: games,
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch games' });
  }
});

/**
 * GET /api/admin/queues
 * Returns current queue/lobby status for each tier
 * Auth: required, Admin only
 * 
 * TODO: Replace stubbed queue data with real DB-backed queue state once queue models are implemented.
 */
router.get('/queues', async (req, res) => {
  try {
    const { QUEUE_CONFIGS } = require('../config/queues');
    
    // TODO: Replace this stub with real queue data from TierGameQueue model
    // For now, return empty queues for all tier/queue combinations
    const queues = QUEUE_CONFIGS.map(config => ({
      tier: config.tier,
      queueSize: config.queueSize,
      currentPlayers: 0, // TODO: Get from queue state
      maxPlayers: config.queueSize,
      status: 'EMPTY', // TODO: Get from queue state (EMPTY/FILLING/READY/RUNNING)
      nextTier: config.nextTier,
      rewardAmount: config.rewardNextTierAmount,
    }));
    
    res.json({
      ok: true,
      queues: queues,
    });
  } catch (error) {
    console.error('Error fetching queues:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch queues' });
  }
});

/**
 * GET /api/admin/tier-stats
 * Returns tier distribution statistics (pyramid view)
 * Auth: required, Admin only
 */
router.get('/tier-stats', async (req, res) => {
  try {
    const { TICKET_TIERS } = require('../config/tickets');
    
    // Get all users with their wallets
    const users = await prisma.user.findMany({
      select: {
        ticketWallet: true,
      },
    });
    
    // Aggregate ticket counts per tier
    const tierStats = {};
    TICKET_TIERS.forEach(tier => {
      tierStats[tier] = {
        tier: tier,
        totalTickets: 0,
        totalUsersHoldingThisTier: 0,
      };
    });
    
    users.forEach(user => {
      if (user.ticketWallet && typeof user.ticketWallet === 'object') {
        let hasAnyTier = false;
        TICKET_TIERS.forEach(tier => {
          const balance = user.ticketWallet[tier] || 0;
          if (typeof balance === 'number' && balance > 0) {
            tierStats[tier].totalTickets += balance;
            hasAnyTier = true;
          }
        });
        
        // Count users who hold this tier
        if (hasAnyTier) {
          TICKET_TIERS.forEach(tier => {
            const balance = user.ticketWallet[tier] || 0;
            if (typeof balance === 'number' && balance > 0) {
              tierStats[tier].totalUsersHoldingThisTier += 1;
            }
          });
        }
      }
    });
    
    // Convert to array, reverse order (DIAMOND first for pyramid)
    const tiers = TICKET_TIERS.slice().reverse().map(tier => tierStats[tier]);
    
    res.json({
      ok: true,
      tiers: tiers,
    });
  } catch (error) {
    console.error('Error fetching tier stats:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch tier stats' });
  }
});

/**
 * GET /api/admin/withdrawals
 * Get all withdrawal requests (admin inbox)
 * Returns pending and recent requests with user info
 */
router.get('/withdrawals', async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    
    const where = {};
    if (status) {
      where.status = status;
    }

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            publicName: true,
            picture: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit),
    });

    res.json({
      ok: true,
      withdrawals: withdrawals,
      total: withdrawals.length,
    });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch withdrawal requests' });
  }
});

/**
 * PUT /api/admin/withdrawals/:id/status
 * Update withdrawal request status (mark as paid, reject, etc.)
 * Body: { status: 'PAID' | 'REJECTED' | 'PROCESSING', adminNotes?: string }
 */
router.put('/withdrawals/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['PENDING', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid status' });
    }

    const updateData = {
      status: status,
      updatedAt: new Date(),
    };

    if (status === 'PAID' || status === 'REJECTED') {
      updateData.processedAt = new Date();
      updateData.processedBy = req.user.id;
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    const withdrawal = await prisma.withdrawalRequest.update({
      where: { id },
      data: updateData,
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

    res.json({
      ok: true,
      withdrawal: withdrawal,
    });
  } catch (error) {
    console.error('Error updating withdrawal status:', error);
    res.status(500).json({ ok: false, error: 'Failed to update withdrawal request' });
  }
});

/**
 * GET /api/admin/withdrawals/stats
 * Get withdrawal statistics for admin dashboard
 */
router.get('/withdrawals/stats', async (req, res) => {
  try {
    const [total, pending, paid, rejected] = await Promise.all([
      prisma.withdrawalRequest.count(),
      prisma.withdrawalRequest.count({ where: { status: 'PENDING' } }),
      prisma.withdrawalRequest.count({ where: { status: 'PAID' } }),
      prisma.withdrawalRequest.count({ where: { status: 'REJECTED' } }),
    ]);

    res.json({
      ok: true,
      stats: {
        total,
        pending,
        paid,
        rejected,
      },
    });
  } catch (error) {
    console.error('Error fetching withdrawal stats:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch withdrawal statistics' });
  }
});

/**
 * GET /api/admin/game-history
 * Returns game history list for admin panel
 * Query params: limit (default 100), tier (optional filter)
 */
router.get('/game-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const histories = await listGameHistory(limit);
    res.json({ ok: true, histories });
  } catch (error) {
    console.error('Error fetching game history:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch game history' });
  }
});

/**
 * GET /api/admin/game-history/:gameNumber
 * Returns detailed game history for admin panel
 */
router.get('/game-history/:gameNumber', async (req, res) => {
  try {
    const gameNumber = BigInt(req.params.gameNumber);
    const history = await getGameHistory(gameNumber);
    if (!history) {
      return res.status(404).json({ ok: false, error: 'Game not found' });
    }
    res.json({ ok: true, history });
  } catch (error) {
    console.error('Error fetching game history detail:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch game history detail' });
  }
});

/**
 * GET /api/admin/users
 * Returns all users with player numbers and basic stats
 */
router.get('/users', async (req, res) => {
  try {
    // Get all users ordered by creation date
    const allUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        publicName: true,
        picture: true,
        avatarUrl: true,
        googleSub: true,
        role: true,
        ticketWallet: true,
        credits: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            lobbyPlayers: true,
            creditEvents: true,
            freeAttempts: true,
          },
        },
      },
    });

    // Find cmbict@gmail.com and ensure it's player 1
    // Assign player numbers: cmbict@gmail.com gets #1, others get sequential numbers by creation order
    let playerNumberMap = new Map();
    let playerNumber = 1;

    // First, assign player 1 to cmbict@gmail.com if they exist
    const cmbictUser = allUsers.find(u => u.email === 'cmbict@gmail.com');
    if (cmbictUser) {
      playerNumberMap.set(cmbictUser.id, 1);
      playerNumber = 2;
    }

    // Then assign numbers to all other users in creation order
    allUsers.forEach((user) => {
      if (!playerNumberMap.has(user.id)) {
        playerNumberMap.set(user.id, playerNumber++);
      }
    });

    // Get first and last game participation for each user
    const userIds = allUsers.map(u => u.id);
    
    // Get all game history players for these users (only if there are users)
    let allGameParticipation = [];
    if (userIds.length > 0) {
      try {
        allGameParticipation = await prisma.gameHistoryPlayer.findMany({
          where: { userId: { in: userIds } },
          include: { 
            gameHistory: { 
              select: { 
                gameNumber: true, 
                resolvedAt: true 
              } 
            } 
          },
        });
      } catch (gameHistoryError) {
        console.warn('[ADMIN] Error fetching game history participation:', gameHistoryError.message);
        // Continue with empty array if this fails
      }
    }

    // Sort and group by userId to find first and last
    const firstGameMap = new Map();
    const lastGameMap = new Map();
    
    // Sort by resolvedAt for each user
    const participationByUser = new Map();
    allGameParticipation.forEach(p => {
      if (!p.userId || !p.gameHistory) return;
      if (!participationByUser.has(p.userId)) {
        participationByUser.set(p.userId, []);
      }
      participationByUser.get(p.userId).push(p);
    });
    
    // Find first and last for each user
    participationByUser.forEach((participations, userId) => {
      const sorted = participations.sort((a, b) => {
        const aTime = a.gameHistory?.resolvedAt?.getTime() || 0;
        const bTime = b.gameHistory?.resolvedAt?.getTime() || 0;
        return aTime - bTime;
      });
      
      if (sorted.length > 0) {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        if (first.gameHistory) {
          // Convert BigInt to string for JSON serialization
          firstGameMap.set(userId, {
            ...first.gameHistory,
            gameNumber: first.gameHistory.gameNumber.toString(),
          });
        }
        if (last.gameHistory) {
          // Convert BigInt to string for JSON serialization
          lastGameMap.set(userId, {
            ...last.gameHistory,
            gameNumber: last.gameHistory.gameNumber.toString(),
          });
        }
      }
    });

    // Get game count per user (handle null userIds)
    let gameCountMap = new Map();
    let winCountMap = new Map();
    
    if (userIds.length > 0) {
      try {
        const gameCounts = await prisma.gameHistoryPlayer.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds } },
          _count: { id: true },
        });
        gameCountMap = new Map(gameCounts.filter(g => g.userId).map(g => [g.userId, g._count.id]));

        // Get win count per user
        const winCounts = await prisma.gameHistoryPlayer.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, isWinner: true },
          _count: { id: true },
        });
        winCountMap = new Map(winCounts.filter(w => w.userId).map(w => [w.userId, w._count.id]));
      } catch (groupByError) {
        console.error('[ADMIN] Error in groupBy queries:', groupByError);
        console.error('[ADMIN] GroupBy error details:', {
          message: groupByError.message,
          code: groupByError.code,
        });
        // Continue with empty maps if groupBy fails
      }
    }

    // Get IP addresses for each user (most recent and all unique IPs)
    const latestIpMap = new Map();
    const allIpsMap = new Map();
    
    if (userIds.length > 0) {
      try {
        // Check if userSession model exists in Prisma client
        if (prisma.userSession && typeof prisma.userSession.findMany === 'function') {
          const userSessions = await prisma.userSession.findMany({
            where: { userId: { in: userIds } },
            orderBy: { lastSeenAt: 'desc' },
          });
          
          userSessions.forEach(session => {
            if (!latestIpMap.has(session.userId)) {
              latestIpMap.set(session.userId, session.ipAddress);
            }
            if (!allIpsMap.has(session.userId)) {
              allIpsMap.set(session.userId, new Set());
            }
            allIpsMap.get(session.userId).add(session.ipAddress);
          });
        } else {
          console.warn('[ADMIN] UserSession model not available in Prisma client. Run: npx prisma generate');
        }
      } catch (ipError) {
        // If UserSession model doesn't exist yet (Prisma client not regenerated), continue without IP data
        console.warn('[ADMIN] UserSession query failed (Prisma client may need regeneration):', ipError.message);
        console.warn('[ADMIN] IP error details:', {
          message: ipError.message,
          code: ipError.code,
          name: ipError.name,
        });
      }
    }

    const users = allUsers.map(user => ({
      id: user.id,
      playerNumber: playerNumberMap.get(user.id) || 0,
      email: user.email,
      name: user.name,
      publicName: user.publicName || user.name || 'Anonymous',
      picture: user.picture,
      avatarUrl: user.avatarUrl || user.picture,
      googleSub: user.googleSub,
      role: user.role,
      ticketWallet: user.ticketWallet || {},
      credits: user.credits,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stats: {
        gamesPlayed: gameCountMap.get(user.id) || 0,
        gamesWon: winCountMap.get(user.id) || 0,
        lobbiesJoined: user._count.lobbyPlayers,
        transactions: user._count.creditEvents,
        freeAttempts: user._count.freeAttempts,
        firstGameAt: firstGameMap.get(user.id)?.resolvedAt || null,
        lastGameAt: lastGameMap.get(user.id)?.resolvedAt || null,
        firstGameNumber: firstGameMap.get(user.id)?.gameNumber || null,
        lastGameNumber: lastGameMap.get(user.id)?.gameNumber || null,
        latestIpAddress: latestIpMap.get(user.id) || null,
        uniqueIpCount: allIpsMap.get(user.id)?.size || 0,
      },
    }));

    res.json({ ok: true, users });
  } catch (error) {
    console.error('[ADMIN] Error fetching users:', error);
    console.error('[ADMIN] Error stack:', error.stack);
    console.error('[ADMIN] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch users',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/admin/users/:id
 * Returns detailed user information including game history
 */
router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        publicName: true,
        picture: true,
        avatarUrl: true,
        googleSub: true,
        role: true,
        ticketWallet: true,
        credits: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // Get player number (same logic as list)
    const allUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    });
    
    let playerNumber = 1;
    const cmbictUser = allUsers.find(u => u.email === 'cmbict@gmail.com');
    
    if (cmbictUser && cmbictUser.id === userId) {
      playerNumber = 1;
    } else {
      let currentNumber = 1;
      for (const u of allUsers) {
        if (u.email === 'cmbict@gmail.com') {
          if (u.id === userId) {
            playerNumber = 1;
            break;
          }
          // Skip assigning number to cmbict here, it's already #1
          continue;
        }
        currentNumber++;
        if (u.id === userId) {
          playerNumber = currentNumber;
          break;
        }
      }
    }

    // Get game history for this user
    const gameHistoryPlayers = await prisma.gameHistoryPlayer.findMany({
      where: { userId },
      include: {
        gameHistory: {
          select: {
            gameNumber: true,
            tier: true,
            status: true,
            resolvedAt: true,
            winningNumber: true,
            spinForceFinal: true,
          },
        },
      },
      take: 100, // Limit to last 100 games
    });

    // Sort game history by resolvedAt in JavaScript
    gameHistoryPlayers.sort((a, b) => {
      const aTime = a.gameHistory?.resolvedAt?.getTime() || 0;
      const bTime = b.gameHistory?.resolvedAt?.getTime() || 0;
      return bTime - aTime; // Descending order
    });

    const gameHistory = gameHistoryPlayers
      .filter(ghp => ghp.gameHistory) // Filter out entries without gameHistory
      .map(ghp => ({
        gameNumber: ghp.gameHistory.gameNumber.toString(),
        tier: ghp.gameHistory.tier,
        status: ghp.gameHistory.status,
        resolvedAt: ghp.gameHistory.resolvedAt,
        winningNumber: ghp.gameHistory.winningNumber,
        spinForceFinal: ghp.gameHistory.spinForceFinal,
        luckyNumber: ghp.luckyNumber,
        isWinner: ghp.isWinner,
        joinedAt: ghp.joinedAt,
      }));

    // Get stats
    const [gamesPlayed, gamesWon, lobbiesJoined, transactions, freeAttempts] = await Promise.all([
      prisma.gameHistoryPlayer.count({ where: { userId } }),
      prisma.gameHistoryPlayer.count({ where: { userId, isWinner: true } }),
      prisma.lobbyPlayer.count({ where: { userId } }),
      prisma.creditTransaction.count({ where: { userId } }),
      prisma.freeAttempt.count({ where: { userId } }),
    ]);

    // Get first and last game (fix orderBy issue)
    const allUserGames = await prisma.gameHistoryPlayer.findMany({
      where: { userId },
      include: { gameHistory: { select: { gameNumber: true, resolvedAt: true } } },
    });

    const sortedGames = allUserGames
      .filter(g => g.gameHistory?.resolvedAt)
      .sort((a, b) => {
        const aTime = a.gameHistory?.resolvedAt?.getTime() || 0;
        const bTime = b.gameHistory?.resolvedAt?.getTime() || 0;
        return aTime - bTime;
      });

    const firstGame = sortedGames.length > 0 ? sortedGames[0] : null;
    const lastGame = sortedGames.length > 0 ? sortedGames[sortedGames.length - 1] : null;

    // Get IP address information
    let userSessions = [];
    let uniqueIps = [];
    let latestIp = null;
    
    try {
      // Check if userSession model exists in Prisma client
      if (prisma.userSession && typeof prisma.userSession.findMany === 'function') {
        userSessions = await prisma.userSession.findMany({
          where: { userId },
          orderBy: { lastSeenAt: 'desc' },
        });
        uniqueIps = [...new Set(userSessions.map(s => s.ipAddress))];
        latestIp = userSessions.length > 0 ? userSessions[0].ipAddress : null;
      } else {
        console.warn('[ADMIN] UserSession model not available in Prisma client. Run: npx prisma generate');
      }
    } catch (ipError) {
      // If UserSession model doesn't exist yet (Prisma client not regenerated), continue without IP data
      console.warn('[ADMIN] UserSession query failed (Prisma client may need regeneration):', ipError.message);
    }

    res.json({
      ok: true,
      user: {
        ...user,
        playerNumber,
        publicName: user.publicName || user.name || 'Anonymous',
        avatarUrl: user.avatarUrl || user.picture,
        gameHistory,
        stats: {
          gamesPlayed,
          gamesWon,
          lobbiesJoined,
          transactions,
          freeAttempts,
          firstGameAt: firstGame?.gameHistory?.resolvedAt || null,
          lastGameAt: lastGame?.gameHistory?.resolvedAt || null,
          firstGameNumber: firstGame?.gameHistory?.gameNumber ? firstGame.gameHistory.gameNumber.toString() : null,
          lastGameNumber: lastGame?.gameHistory?.gameNumber ? lastGame.gameHistory.gameNumber.toString() : null,
          latestIpAddress: latestIp,
          uniqueIpCount: uniqueIps.length,
          allIpAddresses: uniqueIps,
          sessionCount: userSessions.length,
        },
        ipHistory: userSessions.map(s => ({
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          createdAt: s.createdAt,
          lastSeenAt: s.lastSeenAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching user detail:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch user detail' });
  }
});

/**
 * POST /api/admin/users/:id/add-tickets
 * Add tickets of a specific tier to a user
 * Body: { tier: string, amount: number, reason?: string }
 */
router.post('/users/:id/add-tickets', async (req, res) => {
  try {
    const userId = req.params.id;
    const { tier, amount, reason } = req.body;

    // Validate input
    if (!tier || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid input. tier (string) and amount (positive number) are required' 
      });
    }

    // Get admin user info for transaction metadata
    const adminUser = req.user;
    
    // Add tickets using the wallet helper
    const updatedWallet = await addTickets(
      userId,
      tier,
      amount,
      reason || 'ADMIN_MANUAL',
      {
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        timestamp: new Date().toISOString(),
      }
    );

    console.log(`[ADMIN] ${adminUser.email} added ${amount} ${tier} tickets to user ${userId}`);

    res.json({
      ok: true,
      message: `Successfully added ${amount} ${tier} ticket(s)`,
      wallet: updatedWallet,
    });
  } catch (error) {
    console.error('[ADMIN] Error adding tickets:', error);
    res.status(500).json({ 
      ok: false, 
      error: error.message || 'Failed to add tickets' 
    });
  }
});

module.exports = router;

