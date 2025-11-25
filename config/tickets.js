/**
 * Ticket Tier Configuration
 * Defines the 8 ticket tiers for Crypto Tickets
 */

const TICKET_TIERS = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'EMERALD',
  'SAPPHIRE',
  'RUBY',
  'AMETHYST',
  'DIAMOND',
];

/**
 * Tier metadata for UI display
 */
const TIER_METADATA = {
  BRONZE: {
    name: 'Bronze',
    color: '#CD7F32', // Bronze color
    order: 1,
  },
  SILVER: {
    name: 'Silver',
    color: '#C0C0C0', // Silver color
    order: 2,
  },
  GOLD: {
    name: 'Gold',
    color: '#FFD700', // Gold color
    order: 3,
  },
  EMERALD: {
    name: 'Emerald',
    color: '#50C878', // Emerald green
    order: 4,
  },
  SAPPHIRE: {
    name: 'Sapphire',
    color: '#0F52BA', // Sapphire blue
    order: 5,
  },
  RUBY: {
    name: 'Ruby',
    color: '#E0115F', // Ruby red
    order: 6,
  },
  AMETHYST: {
    name: 'Amethyst',
    color: '#9966CC', // Amethyst purple
    order: 7,
  },
  DIAMOND: {
    name: 'Diamond',
    color: '#B9F2FF', // Diamond blue-white
    order: 8,
  },
};

/**
 * Validate if a tier is valid
 */
function isValidTier(tier) {
  return TICKET_TIERS.includes(tier);
}

/**
 * Get next tier (for progression)
 */
function getNextTier(tier) {
  const index = TICKET_TIERS.indexOf(tier);
  if (index === -1 || index === TICKET_TIERS.length - 1) {
    return null;
  }
  return TICKET_TIERS[index + 1];
}

/**
 * Create empty wallet (all tiers at 0)
 */
function createEmptyWallet() {
  const wallet = {};
  TICKET_TIERS.forEach(tier => {
    wallet[tier] = 0;
  });
  return wallet;
}

module.exports = {
  TICKET_TIERS,
  TIER_METADATA,
  isValidTier,
  getNextTier,
  createEmptyWallet,
};

