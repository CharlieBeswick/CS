/**
 * Lobby configuration for tier games.
 * All tiers use the same configuration for now.
 */

const { TICKET_TIERS } = require('./tickets');

const DEFAULT_LOBBY_CONFIG = {};

// Create config for all tiers
TICKET_TIERS.forEach(tier => {
  DEFAULT_LOBBY_CONFIG[tier] = {
    tier: tier,
    minPlayers: 3, // For testing - will be adjusted later
    maxPlayers: 20, // Lobbies fill to 20 then auto-start
    baseSpinForce: 18,
    countdownSeconds: 8,
    maxCountdownSeconds: 12,
    spinDurationMs: 5500,
    waitTimeoutMs: 5 * 60 * 1000, // 5 minutes before auto-cancel
  };
});

const LOBBY_STATUS_ORDER = ['WAITING', 'COUNTDOWN', 'SPINNING', 'RESOLVED', 'CANCELLED'];

function getLobbyConfig(tier = 'BRONZE') {
  return DEFAULT_LOBBY_CONFIG[tier] || null;
}

module.exports = {
  DEFAULT_LOBBY_CONFIG,
  LOBBY_STATUS_ORDER,
  getLobbyConfig,
};

