const prisma = require('./prisma');
const { HISTORY_MAX_ROWS, HISTORY_ARCHIVE_BATCH } = require('../config/history');

async function archiveOldGameHistory(tx = prisma) {
  const total = await tx.gameHistory.count();
  if (total <= HISTORY_MAX_ROWS) {
    return;
  }

  const rows = await tx.gameHistory.findMany({
    orderBy: { gameNumber: 'asc' },
    take: HISTORY_ARCHIVE_BATCH,
    include: { players: true },
  });

  if (!rows.length) {
    return;
  }

  const rangeStart = rows[0].gameNumber;
  const rangeEnd = rows[rows.length - 1].gameNumber;

  await tx.gameHistoryArchive.create({
    data: {
      rangeStart,
      rangeEnd,
      gameCount: rows.length,
      payload: rows,
    },
  });

  const historyIds = rows.map((row) => row.id);
  await tx.gameHistory.deleteMany({
    where: { id: { in: historyIds } },
  });

  console.log('[history] archived old games', {
    rangeStart: rangeStart.toString(),
    rangeEnd: rangeEnd.toString(),
    archived: rows.length,
  });
}

async function getNextGameNumber(tx = prisma) {
  // Get the highest gameNumber from both active and archived games
  const [maxActive, maxArchived] = await Promise.all([
    tx.gameHistory.findFirst({
      orderBy: { gameNumber: 'desc' },
      select: { gameNumber: true },
    }),
    tx.gameHistoryArchive.findFirst({
      orderBy: { rangeEnd: 'desc' },
      select: { rangeEnd: true },
    }),
  ]);

  const maxActiveNum = maxActive?.gameNumber ? Number(maxActive.gameNumber) : 0;
  const maxArchivedNum = maxArchived?.rangeEnd ? Number(maxArchived.rangeEnd) : 0;
  const maxNum = Math.max(maxActiveNum, maxArchivedNum);

  // Return next number (start at 1 if no games exist)
  return BigInt(maxNum + 1);
}

async function recordGameHistory(lobbyId) {
  return prisma.$transaction(async (tx) => {
    const lobby = await tx.tierLobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                publicName: true,
              },
            },
          },
        },
        round: true,
      },
    });

    if (!lobby || !lobby.round) {
      return null;
    }

    // Get the next game number
    const gameNumber = await getNextGameNumber(tx);

    const round = lobby.round;
    const history = await tx.gameHistory.create({
      data: {
        gameNumber,
        lobbyId: lobby.id,
        tier: lobby.tier,
        status: lobby.status,
        playerCount: lobby.players.length,
        minPlayers: lobby.minPlayers,
        maxPlayers: lobby.maxPlayers,
        spinForceBase: round.spinForceBase,
        spinForceTotal: round.spinForceTotal,
        spinForceFinal: round.spinForceFinal,
        spinRotationStart: round.spinRotationStart,
        spinRotationEnd: round.spinRotationEnd,
        spinTotalDegrees: round.spinTotalDegrees,
        winningNumber: round.winningNumber,
        winningSegment: round.winningSegment,
        seed: round.seed,
        wheelSegments: round.wheelSegments,
        countdownStartedAt: lobby.countdownStartsAt,
        gameStartedAt: lobby.gameStartsAt,
        resolvedAt: lobby.resolvedAt || round.resolvedAt,
      },
    });

    const playerCreates = lobby.players.map((player) => {
      const isWinner =
        typeof round.winningNumber === 'number' &&
        player.luckyNumber === round.winningNumber;

      return tx.gameHistoryPlayer.create({
        data: {
          gameHistoryId: history.id,
          userId: player.userId,
          displayName: player.user?.publicName || null,
          email: player.user?.email || null,
          luckyNumber: player.luckyNumber,
          ticketTierUsed: player.ticketTierUsed,
          joinedAt: player.joinedAt,
          isWinner,
        },
      });
    });

    await Promise.all(playerCreates);
    await archiveOldGameHistory(tx);

    return history;
  });
}

async function listGameHistory(limit = 50) {
  const histories = await prisma.gameHistory.findMany({
    orderBy: { gameNumber: 'desc' },
    take: limit,
  });

  return histories.map((history) => serializeHistory(history));
}

async function getGameHistory(gameNumber) {
  const history = await prisma.gameHistory.findUnique({
    where: { gameNumber },
    include: { players: true },
  });

  if (!history) {
    return null;
  }

  return {
    ...serializeHistory(history),
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
  };
}

function serializeHistory(history) {
  return {
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
    spinRotationStart: history.spinRotationStart,
    spinRotationEnd: history.spinRotationEnd,
    spinTotalDegrees: history.spinTotalDegrees,
    winningNumber: history.winningNumber,
    winningSegment: history.winningSegment,
    seed: history.seed,
    countdownStartedAt: history.countdownStartedAt,
    gameStartedAt: history.gameStartedAt,
    resolvedAt: history.resolvedAt,
    createdAt: history.createdAt,
  };
}

module.exports = {
  recordGameHistory,
  listGameHistory,
  getGameHistory,
};

