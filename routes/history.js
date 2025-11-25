const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const prisma = require('../lib/prisma');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const histories = await prisma.gameHistory.findMany({
      orderBy: { gameNumber: 'desc' },
      take: limit,
    });

    res.json({
      ok: true,
      histories: histories.map((history) => ({
        id: history.id,
        gameNumber: history.gameNumber.toString(),
        tier: history.tier,
        status: history.status,
        playerCount: history.playerCount,
        spinForceFinal: history.spinForceFinal,
        winningNumber: history.winningNumber,
        resolvedAt: history.resolvedAt,
      })),
    });
  } catch (error) {
    console.error('Error loading game history list:', error);
    res.status(500).json({ ok: false, error: 'Failed to load game history' });
  }
});

router.get('/:gameNumber', async (req, res) => {
  try {
    const gameNumber = BigInt(req.params.gameNumber);
    const history = await prisma.gameHistory.findUnique({
      where: { gameNumber },
      include: { players: true },
    });

    if (!history) {
      return res.status(404).json({ ok: false, error: 'Game history not found' });
    }

    res.json({
      ok: true,
      history: {
        id: history.id,
        gameNumber: history.gameNumber.toString(),
        lobbyId: history.lobbyId,
        tier: history.tier,
        status: history.status,
        playerCount: history.playerCount,
        minPlayers: history.minPlayers,
        maxPlayers: history.maxPlayers,
        spinForceBase: history.spinForceBase,
        spinForceTotal: history.spinForceTotal,
        spinForceFinal: history.spinForceFinal,
        winningNumber: history.winningNumber,
        winningSegment: history.winningSegment,
        seed: history.seed,
        countdownStartedAt: history.countdownStartedAt,
        gameStartedAt: history.gameStartedAt,
        resolvedAt: history.resolvedAt,
        players: history.players.map((player) => ({
          id: player.id,
          userId: player.userId,
          displayName: player.displayName,
          email: player.email,
          luckyNumber: player.luckyNumber,
          ticketTierUsed: player.ticketTierUsed,
          joinedAt: player.joinedAt,
          isWinner: player.isWinner,
        })),
      },
    });
  } catch (error) {
    console.error('Error loading game history detail:', error);
    res.status(500).json({ ok: false, error: 'Failed to load game history detail' });
  }
});

module.exports = router;

