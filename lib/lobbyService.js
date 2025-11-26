/**
 * Lobby service helpers
 * Handles matchmaking, lobby lifecycle, chat and serialization logic
 */

const crypto = require('crypto');
const prisma = require('./prisma');
const { consumeTickets, addTickets } = require('./walletHelpers');
const { recordGameHistory } = require('./historyService');
const { getLobbyConfig } = require('../config/lobbies');

const ACTIVE_STATUSES = ['WAITING', 'COUNTDOWN', 'SPINNING'];
const LUCKY_MIN = 2;
const LUCKY_MAX = 9;

function buildWheelSegments(count = 20) {
  return Array.from({ length: count }, (_, idx) => idx + 1);
}

function normalizeRotation(rotation) {
  let normalized = rotation % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

function getSegmentForRotation(rotation, segmentCount = 20) {
  const normalized = normalizeRotation(rotation);
  const arrowAngleInOriginal = (270 - normalized + 360) % 360;
  const diff = (arrowAngleInOriginal - 279 + 360) % 360;
  let segmentIndex = Math.round(diff / (360 / segmentCount)) % segmentCount;
  if (segmentIndex < 0) segmentIndex += segmentCount;
  return segmentIndex + 1;
}

function calculateSpinTrajectory(spinForceFinal, seed, winningSegment, segmentCount = 20) {
  const seedInt = parseInt(seed.slice(8, 16), 16);
  const rotationStart = seedInt % 360;
  const minRotations = 6;
  const extraRotations = Math.max(0, Math.floor(spinForceFinal / 5));
  const totalRotations = minRotations + extraRotations;
  const baseRotation = rotationStart + totalRotations * 360;

  let rotationEnd = baseRotation;
  const step = 0.5;
  const maxAdjustment = 360;
  let found = false;
  for (let offset = 0; offset <= maxAdjustment; offset += step) {
    const candidate = baseRotation + offset;
    if (getSegmentForRotation(candidate, segmentCount) === winningSegment) {
      rotationEnd = candidate;
      found = true;
      break;
    }
  }
  if (!found) {
    rotationEnd = baseRotation;
  }

  const spinTotalDegrees = rotationEnd - rotationStart;
  return {
    rotationStart,
    rotationEnd,
    spinTotalDegrees,
  };
}

function sanitizeLuckyNumber(value) {
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < LUCKY_MIN || num > LUCKY_MAX) return null;
  return num;
}

async function ensureLobby(tier = 'BRONZE', lobbyIndex = 0) {
  const config = getLobbyConfig(tier);
  if (!config) {
    throw new Error(`Unsupported tier: ${tier}`);
  }

  // Determine how many lobbies should exist for this tier
  // BRONZE, SILVER, GOLD: 2 lobbies each
  // EMERALD, SAPPHIRE, RUBY, AMETHYST, DIAMOND: 1 lobby each
  const tierLobbyCounts = {
    BRONZE: 2,
    SILVER: 2,
    GOLD: 2,
    EMERALD: 1,
    SAPPHIRE: 1,
    RUBY: 1,
    AMETHYST: 1,
    DIAMOND: 1,
  };
  const maxLobbies = tierLobbyCounts[tier] || 1;

  // Find existing WAITING lobbies for this tier with player counts
  const existingLobbies = await prisma.tierLobby.findMany({
    where: {
      tier,
      status: 'WAITING',
    },
    include: {
      players: {
        where: { isActive: true },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Add player count to each lobby
  const lobbiesWithCounts = existingLobbies.map(lobby => ({
    ...lobby,
    playerCount: lobby.players.length,
  }));

  // Sort by player count (descending) - fill the one with most players first
  // Then by creation date (ascending) - oldest first if same player count
  lobbiesWithCounts.sort((a, b) => {
    if (a.playerCount !== b.playerCount) {
      return b.playerCount - a.playerCount; // More players first
    }
    return a.createdAt - b.createdAt; // Older first if same count
  });

  // Find the first lobby that isn't full
  let selectedLobby = lobbiesWithCounts.find(l => l.playerCount < l.maxPlayers);

  // If all WAITING lobbies are full, check if we need to create a new one
  if (!selectedLobby) {
    // If we have fewer than maxLobbies, create a new one
    if (existingLobbies.length < maxLobbies) {
      const newLobby = await prisma.tierLobby.create({
        data: {
          tier,
          minPlayers: config.minPlayers,
          maxPlayers: config.maxPlayers,
          baseSpinForce: config.baseSpinForce,
          countdownSeconds: config.countdownSeconds,
        },
      });
      console.log('[lobby] created new lobby (all existing full)', { tier, lobbyId: newLobby.id });
      selectedLobby = newLobby;
    } else {
      // All lobbies exist and are full - use the oldest one (it should transition to COUNTDOWN soon)
      // But actually, if all are full, they should be transitioning. Let's use the first one.
      selectedLobby = lobbiesWithCounts[0];
      console.log('[lobby] all lobbies full, using oldest', { tier, lobbyId: selectedLobby.id, playerCount: selectedLobby.playerCount });
    }
  }

  // Ensure we have at least maxLobbies WAITING lobbies (create if needed)
  while (existingLobbies.length < maxLobbies) {
    const newLobby = await prisma.tierLobby.create({
      data: {
        tier,
        minPlayers: config.minPlayers,
        maxPlayers: config.maxPlayers,
        baseSpinForce: config.baseSpinForce,
        countdownSeconds: config.countdownSeconds,
      },
    });
    existingLobbies.push(newLobby);
    console.log('[lobby] created new lobby (initialization)', { tier, lobbyId: newLobby.id, index: existingLobbies.length - 1 });
    
    // If we just created the first lobby and haven't selected one yet, use this one
    if (!selectedLobby) {
      selectedLobby = newLobby;
    }
  }

  const lobby = selectedLobby;
  
  // Sync config if needed
  if (lobby) {
    const needsUpdate =
      lobby.minPlayers !== config.minPlayers ||
      lobby.maxPlayers !== config.maxPlayers ||
      lobby.baseSpinForce !== config.baseSpinForce ||
      lobby.countdownSeconds !== config.countdownSeconds;

    if (needsUpdate) {
      const updated = await prisma.tierLobby.update({
        where: { id: lobby.id },
        data: {
          minPlayers: config.minPlayers,
          maxPlayers: config.maxPlayers,
          baseSpinForce: config.baseSpinForce,
          countdownSeconds: config.countdownSeconds,
        },
      });
      console.log('[lobby] synchronized config', {
        lobbyId: updated.id,
        tier,
        minPlayers: updated.minPlayers,
        maxPlayers: updated.maxPlayers,
      });
      return updated;
    }
  }

  return lobby;
}

/**
 * Initialize all required lobbies for all tiers
 * Called on server startup to ensure proper lobby counts
 */
async function initializeAllLobbies() {
  const { TICKET_TIERS } = require('../config/tickets');
  const tierLobbyCounts = {
    BRONZE: 2,
    SILVER: 2,
    GOLD: 2,
    EMERALD: 1,
    SAPPHIRE: 1,
    RUBY: 1,
    AMETHYST: 1,
    DIAMOND: 1,
  };

  for (const tier of TICKET_TIERS) {
    const count = tierLobbyCounts[tier] || 1;
    for (let i = 0; i < count; i++) {
      await ensureLobby(tier, i);
    }
  }
  console.log('[lobby] initialized all tier lobbies');
}

async function loadLobbyGraph(lobbyId) {
  return prisma.tierLobby.findUnique({
    where: { id: lobbyId },
    include: {
      players: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              publicName: true,
              avatarUrl: true,
              picture: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      round: true,
    },
  });
}

function formatPlayer(player, lobbyStatus, viewerId) {
  const hideLuckyNumber = lobbyStatus === 'WAITING' && player.userId !== viewerId;
  return {
    id: player.id,
    userId: player.userId,
    displayName: player.user?.publicName || 'Anonymous',
    avatar: player.user?.avatarUrl || player.user?.picture || null,
    luckyNumber: hideLuckyNumber ? null : player.luckyNumber,
    luckyNumberRevealed: !hideLuckyNumber,
    isYou: player.userId === viewerId,
    joinedAt: player.joinedAt,
  };
}

function serializeLobby(lobby, viewerId) {
  if (!lobby) return null;

  const playerCount = lobby.players?.length || 0;
  const round = lobby.round || null;

  return {
    id: lobby.id,
    tier: lobby.tier,
    status: lobby.status,
    minPlayers: lobby.minPlayers,
    maxPlayers: lobby.maxPlayers,
    baseSpinForce: lobby.baseSpinForce,
    countdownSeconds: lobby.countdownSeconds,
    countdownStartsAt: lobby.countdownStartsAt,
    countdownEndsAt: lobby.gameStartsAt,
    spinEndsAt: round?.spinCompletedAt || null,
    resolvedAt: lobby.resolvedAt,
    createdAt: lobby.createdAt,
    luckyNumberRange: { min: LUCKY_MIN, max: LUCKY_MAX },
    ticketTierRequired: lobby.tier,
    playerCount,
    players: (lobby.players || []).map(player => formatPlayer(player, lobby.status, viewerId)),
    round: round
      ? {
          id: round.id,
          spinForceBase: round.spinForceBase,
          spinForceTotal: round.spinForceTotal,
          spinForceFinal: round.spinForceFinal,
          spinRotationStart: round.spinRotationStart,
          spinRotationEnd: round.spinRotationEnd,
          spinTotalDegrees: round.spinTotalDegrees,
          winningSegment: round.winningSegment,
          winningNumber: round.winningNumber,
          wheelSegments: round.wheelSegments,
          seed: round.seed,
          spinStartedAt: round.spinStartedAt,
          spinCompletedAt: round.spinCompletedAt,
          resolvedAt: round.resolvedAt,
        }
      : null,
  };
}

async function maybeStartCountdown(lobbyId) {
  return prisma.$transaction(async (tx) => {
    const lobby = await tx.tierLobby.findUnique({
      where: { id: lobbyId },
      include: { players: { where: { isActive: true } } },
    });
    if (!lobby || lobby.status !== 'WAITING') {
      return lobby;
    }

    const config = getLobbyConfig(lobby.tier);
    const activeCount = lobby.players.length;
    if (activeCount < lobby.minPlayers) {
      return lobby;
    }

    // Auto-start immediately when maxPlayers (20) is reached
    const totalSpinForce = lobby.players.reduce((sum, player) => sum + player.luckyNumber, 0);
    const now = new Date();
    const seconds = lobby.maxPlayers === activeCount
      ? 3 // Short countdown when full (3 seconds)
      : config.countdownSeconds;
    const gameStartsAt = new Date(now.getTime() + seconds * 1000);

    const wheelSegments = buildWheelSegments();
    const spinForceBase = lobby.baseSpinForce || config.baseSpinForce;

    await tx.tierLobby.update({
      where: { id: lobby.id },
      data: {
        status: 'COUNTDOWN',
        countdownStartsAt: now,
        gameStartsAt,
      },
    });

    await tx.lobbyPlayer.updateMany({
      where: { lobbyId: lobby.id },
      data: { luckyNumberRevealed: true },
    });

    await tx.lobbyRound.upsert({
      where: { lobbyId: lobby.id },
      update: {
        spinForceBase,
        spinForceTotal: totalSpinForce,
        spinForceFinal: spinForceBase + totalSpinForce,
        wheelSegments,
        createdAt: now,
      },
      create: {
        lobbyId: lobby.id,
        spinForceBase,
        spinForceTotal: totalSpinForce,
        spinForceFinal: spinForceBase + totalSpinForce,
        wheelSegments,
      },
    });

    console.log('[lobby] countdown started', {
      lobbyId: lobby.id,
      playerCount: activeCount,
      totalSpinForce,
    });

    return lobby;
  });
}

async function startSpinning(lobby) {
  const config = getLobbyConfig(lobby.tier);
  const now = new Date();
  const spinDurationMs = config.spinDurationMs || 5000;
  const wheelSegments = buildWheelSegments();

  const activePlayers = await prisma.lobbyPlayer.findMany({
    where: { lobbyId: lobby.id, isActive: true },
  });
  const totalSpinForce = activePlayers.reduce((sum, player) => sum + player.luckyNumber, 0);
  const spinForceBase = lobby.baseSpinForce || config.baseSpinForce;
  const spinForceFinal = spinForceBase + totalSpinForce;
  const seedSource = `${lobby.id}:${spinForceFinal}:${now.getTime()}`;
  const seed = crypto.createHash('sha256').update(seedSource).digest('hex');
  const winningSegment = (parseInt(seed.slice(0, 8), 16) % wheelSegments.length) + 1;
  const spinCompletedAt = new Date(now.getTime() + spinDurationMs);
  const trajectory = calculateSpinTrajectory(spinForceFinal, seed, winningSegment, wheelSegments.length);

  await prisma.lobbyRound.upsert({
    where: { lobbyId: lobby.id },
    update: {
      spinForceBase,
      spinForceTotal: totalSpinForce,
      spinForceFinal,
      wheelSegments,
      seed,
      winningSegment,
      winningNumber: winningSegment,
      spinStartedAt: now,
      spinCompletedAt,
      spinRotationStart: trajectory.rotationStart,
      spinRotationEnd: trajectory.rotationEnd,
      spinTotalDegrees: trajectory.spinTotalDegrees,
    },
    create: {
      lobbyId: lobby.id,
      spinForceBase,
      spinForceTotal: totalSpinForce,
      spinForceFinal,
      wheelSegments,
      seed,
      winningSegment,
      winningNumber: winningSegment,
      spinStartedAt: now,
      spinCompletedAt,
      spinRotationStart: trajectory.rotationStart,
      spinRotationEnd: trajectory.rotationEnd,
      spinTotalDegrees: trajectory.spinTotalDegrees,
    },
  });

  const updated = await prisma.tierLobby.update({
    where: { id: lobby.id },
    data: {
      status: 'SPINNING',
      gameStartsAt: lobby.gameStartsAt || now,
    },
  });

  console.log('[lobby] spin started', {
    lobbyId: lobby.id,
    spinForceFinal,
    winningSegment,
  });

  return updated;
}

async function resolveLobby(lobby) {
  const now = new Date();
  await prisma.lobbyRound.updateMany({
    where: { lobbyId: lobby.id },
    data: { resolvedAt: now },
  });
  const updated = await prisma.tierLobby.update({
    where: { id: lobby.id },
    data: {
      status: 'RESOLVED',
      resolvedAt: now,
    },
  });

  console.log('[lobby] resolved', { lobbyId: lobby.id });
  await recordGameHistory(lobby.id);
  return updated;
}

async function advanceLobbyState(lobbyId) {
  let lobby = await prisma.tierLobby.findUnique({
    where: { id: lobbyId },
    include: { round: true },
  });

  if (!lobby) {
    return null;
  }

  const now = new Date();
  if (lobby.status === 'COUNTDOWN' && lobby.gameStartsAt && now >= lobby.gameStartsAt) {
    lobby = await startSpinning(lobby);
    lobby = await prisma.tierLobby.findUnique({ where: { id: lobby.id }, include: { round: true } });
  }

  if (lobby.status === 'SPINNING' && lobby.round?.spinCompletedAt) {
    const spinCompletedAt = new Date(lobby.round.spinCompletedAt);
    if (now >= spinCompletedAt) {
      lobby = await resolveLobby(lobby);
      lobby = await prisma.tierLobby.findUnique({ where: { id: lobby.id }, include: { round: true } });
    }
  }

  return lobby;
}

async function joinLobby({ userId, luckyNumber, tier = 'BRONZE' }) {
  const sanitizedLucky = sanitizeLuckyNumber(luckyNumber);
  if (sanitizedLucky === null) {
    throw new Error('Lucky number must be between 2 and 9');
  }

  let lobby = await ensureLobby(tier);
  if (lobby.status !== 'WAITING') {
    // create a fresh lobby for new entrants
    lobby = await prisma.tierLobby.create({
      data: {
        tier,
        minPlayers: lobby.minPlayers,
        maxPlayers: lobby.maxPlayers,
        baseSpinForce: lobby.baseSpinForce,
        countdownSeconds: lobby.countdownSeconds,
      },
    });
  }

  const existingPlayer = await prisma.lobbyPlayer.findFirst({
    where: { lobbyId: lobby.id, userId, isActive: true },
  });

  if (existingPlayer) {
    if (lobby.status !== 'WAITING') {
      return serializeLobby(await loadLobbyGraph(lobby.id), userId);
    }

    await prisma.lobbyPlayer.update({
      where: { id: existingPlayer.id },
      data: {
        luckyNumber: sanitizedLucky,
        lastLuckyNumberChange: new Date(),
      },
    });

    console.log('[lobby] lucky number updated via join', { lobbyId: lobby.id, userId, luckyNumber: sanitizedLucky });
    return serializeLobby(await loadLobbyGraph(lobby.id), userId);
  }

  let activeCount = await prisma.lobbyPlayer.count({
    where: { lobbyId: lobby.id, isActive: true },
  });

  // If the selected lobby is full, find the next available one
  if (activeCount >= lobby.maxPlayers && lobby.status === 'WAITING') {
    // Find another WAITING lobby that isn't full
    const availableLobbies = await prisma.tierLobby.findMany({
      where: {
        tier,
        status: 'WAITING',
        id: { not: lobby.id }, // Exclude the full one
      },
      include: {
        players: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Find one that isn't full
    const nextLobby = availableLobbies.find(l => l.players.length < l.maxPlayers);
    if (nextLobby) {
      lobby = nextLobby;
      activeCount = nextLobby.players.length;
      console.log('[lobby] switched to next available lobby', { tier, fromLobbyId: lobby.id, toLobbyId: nextLobby.id, playerCount: activeCount });
    } else {
      // All existing lobbies are full, create a new one
      lobby = await prisma.tierLobby.create({
        data: {
          tier,
          minPlayers: lobby.minPlayers,
          maxPlayers: lobby.maxPlayers,
          baseSpinForce: lobby.baseSpinForce,
          countdownSeconds: lobby.countdownSeconds,
        },
      });
      activeCount = 0;
      console.log('[lobby] created new lobby (all existing full)', { tier, lobbyId: lobby.id });
    }
  }

  if (activeCount >= lobby.maxPlayers) {
    throw new Error('Lobby is full. Please try again in a moment.');
  }

  // Spend or reserve ticket
  await consumeTickets(userId, tier, 1, 'LOBBY_JOIN', {
    lobbyId: lobby.id,
    tier,
  });

  const ticketTransaction = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      reason: 'LOBBY_JOIN',
    },
    orderBy: { createdAt: 'desc' },
  });

  try {
    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: lobby.id,
        userId,
        luckyNumber: sanitizedLucky,
        ticketTierUsed: tier,
        ticketTransactionId: ticketTransaction?.id || null,
      },
    });
    console.log('[lobby] player joined', { lobbyId: lobby.id, userId, luckyNumber: sanitizedLucky });
  } catch (error) {
    console.error('[lobby] failed to create player, refunding ticket', { lobbyId: lobby.id, userId, error });
    await addTickets(userId, tier, 1, 'LOBBY_JOIN_REFUND', { lobbyId: lobby.id });
    throw error;
  }

  await maybeStartCountdown(lobby.id);
  await advanceLobbyState(lobby.id);
  return serializeLobby(await loadLobbyGraph(lobby.id), userId);
}

async function chooseLuckyNumber({ lobbyId, userId, luckyNumber }) {
  const sanitized = sanitizeLuckyNumber(luckyNumber);
  if (sanitized === null) {
    throw new Error('Lucky number must be between 2 and 9');
  }

  const lobby = await prisma.tierLobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) {
    throw new Error('Lobby not found');
  }
  if (lobby.status !== 'WAITING') {
    throw new Error('Lucky number can only be changed while lobby is waiting');
  }

  const player = await prisma.lobbyPlayer.findFirst({
    where: { lobbyId, userId, isActive: true },
  });
  if (!player) {
    throw new Error('You are not part of this lobby');
  }

  await prisma.lobbyPlayer.update({
    where: { id: player.id },
    data: {
      luckyNumber: sanitized,
      lastLuckyNumberChange: new Date(),
    },
  });

  console.log('[lobby] lucky number updated', { lobbyId, userId, luckyNumber: sanitized });
  await maybeStartCountdown(lobbyId);
  await advanceLobbyState(lobbyId);
  return serializeLobby(await loadLobbyGraph(lobbyId), userId);
}

async function getLobbyState({ lobbyId, userId }) {
  await advanceLobbyState(lobbyId);
  return serializeLobby(await loadLobbyGraph(lobbyId), userId);
}

async function getActiveLobbyState({ tier = 'BRONZE', userId }) {
  // First, check if user is already in a WAITING lobby for this tier
  const existingPlayer = await prisma.lobbyPlayer.findFirst({
    where: {
      userId,
      isActive: true,
      lobby: {
        tier,
        status: 'WAITING',
      },
    },
    include: {
      lobby: true,
    },
    orderBy: { joinedAt: 'desc' },
  });

  let lobby;
  if (existingPlayer?.lobby) {
    // User is already in a lobby - use that one
    lobby = existingPlayer.lobby;
  } else {
    // User not in a lobby - get the best available one
    lobby = await ensureLobby(tier);
  }

  await advanceLobbyState(lobby.id);
  return serializeLobby(await loadLobbyGraph(lobby.id), userId);
}

async function postChatMessage({ lobbyId, userId, message }) {
  const trimmed = (message || '').trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty');
  }
  if (trimmed.length > 400) {
    throw new Error('Message is too long');
  }

  const player = await prisma.lobbyPlayer.findFirst({
    where: { lobbyId, userId, isActive: true },
  });
  if (!player) {
    throw new Error('Join the lobby to chat');
  }

  const chatMessage = await prisma.lobbyChatMessage.create({
    data: {
      lobbyId,
      userId,
      message: trimmed,
    },
    include: {
      user: {
        select: {
          id: true,
          publicName: true,
          avatarUrl: true,
          picture: true,
        },
      },
    },
  });

  console.log('[lobby] chat message', { lobbyId, userId });
  return {
    id: chatMessage.id,
    lobbyId,
    userId,
    message: chatMessage.message,
    createdAt: chatMessage.createdAt,
    displayName: chatMessage.user?.publicName || 'Anonymous',
    avatar: chatMessage.user?.avatarUrl || chatMessage.user?.picture || null,
    isYou: true,
  };
}

async function fetchChatMessages(lobbyId, limit = 30) {
  const messages = await prisma.lobbyChatMessage.findMany({
    where: { lobbyId },
    include: {
      user: {
        select: {
          id: true,
          publicName: true,
          avatarUrl: true,
          picture: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return messages
    .map(msg => ({
      id: msg.id,
      lobbyId: msg.lobbyId,
      userId: msg.userId,
      message: msg.message,
      createdAt: msg.createdAt,
      displayName: msg.user?.publicName || 'Anonymous',
      avatar: msg.user?.avatarUrl || msg.user?.picture || null,
    }))
    .reverse();
}

async function listLobbiesForAdmin(filters = {}) {
  const { tier, status, days } = filters;
  const where = {};
  if (tier) where.tier = tier;
  if (status) {
    where.status = status;
  } else {
    // Default: only show active lobbies (exclude RESOLVED and CANCELLED)
    where.status = { in: ACTIVE_STATUSES };
  }
  if (days) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where.createdAt = { gte: since };
  }

  const lobbies = await prisma.tierLobby.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      players: true,
      round: true,
    },
    take: 200,
  });

  return lobbies.map(lobby => ({
    id: lobby.id,
    tier: lobby.tier,
    status: lobby.status,
    playerCount: lobby.players.length,
    minPlayers: lobby.minPlayers,
    maxPlayers: lobby.maxPlayers,
    createdAt: lobby.createdAt,
    countdownStartsAt: lobby.countdownStartsAt,
    gameStartsAt: lobby.gameStartsAt,
    resolvedAt: lobby.resolvedAt,
    round: lobby.round
      ? {
          id: lobby.round.id,
          spinForceFinal: lobby.round.spinForceFinal,
          winningNumber: lobby.round.winningNumber,
        }
      : null,
  }));
}

async function getLobbyForAdmin(lobbyId) {
  const lobby = await prisma.tierLobby.findUnique({
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
  if (!lobby) {
    return null;
  }
  return {
    ...serializeLobby(lobby, null),
    players: lobby.players.map(player => ({
      id: player.id,
      userId: player.userId,
      email: player.user?.email,
      displayName: player.user?.publicName || 'Anonymous',
      luckyNumber: player.luckyNumber,
      joinedAt: player.joinedAt,
      ticketTierUsed: player.ticketTierUsed,
      ticketTransactionId: player.ticketTransactionId,
    })),
  };
}

module.exports = {
  ACTIVE_STATUSES,
  joinLobby,
  chooseLuckyNumber,
  getLobbyState,
  getActiveLobbyState,
  postChatMessage,
  fetchChatMessages,
  listLobbiesForAdmin,
  getLobbyForAdmin,
  initializeAllLobbies,
  sanitizeLuckyNumber,
};

