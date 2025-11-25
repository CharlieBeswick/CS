/**
 * Crypto Tickets Economy Configuration
 * 
 * IMPORTANT: All $ values in this file are INTERNAL ONLY.
 * They must NEVER be displayed to players or exposed in API responses.
 * 
 * These values are used for:
 * - Internal analytics and tracking
 * - Economic modeling and balance calculations
 * - Future reward calculations
 * 
 * TODO: Do not expose internal valuations to the client.
 */

const { TICKET_TIERS } = require('./tickets');

/**
 * Ticket Tier Type
 * @typedef {('BRONZE'|'SILVER'|'GOLD'|'EMERALD'|'SAPPHIRE'|'RUBY'|'AMETHYST'|'DIAMOND')} TicketTier
 */

/**
 * Tier Economy Configuration
 * @typedef {Object} TierEconomyConfig
 * @property {TicketTier} tier - The ticket tier
 * @property {number} bronzeEquivalent - How many Bronze tickets 1 unit of this tier represents
 * @property {number} adBackedValueUsd - Bronze equivalent × $0.005 (pure ad revenue math)
 * @property {number} inheritedValueUsd - Based on pricedAtUsd of previous tier × 20 (ladder value)
 * @property {number} pricedAtUsd - The "official" internal valuation (intentionally discounted)
 */

/**
 * Baseline ad revenue per rewarded ad view
 * 1 Bronze ticket = 1 ad view = $0.005 (0.5 cents)
 */
const BASELINE_AD_REVENUE_USD = 0.005;

/**
 * Tier progression multiplier
 * Each tier is 20× the previous tier
 */
const TIER_MULTIPLIER = 20;

/**
 * Complete tier economy configuration
 * 
 * Values are calculated as follows:
 * - bronzeEquivalent: 20^(tier_order - 1)
 * - adBackedValueUsd: bronzeEquivalent × BASELINE_AD_REVENUE_USD
 * - inheritedValueUsd: previous_tier.pricedAtUsd × TIER_MULTIPLIER
 * - pricedAtUsd: Intentionally discounted from inherited value for economic balance
 */
const TIER_ECONOMY = {
  BRONZE: {
    tier: 'BRONZE',
    bronzeEquivalent: 1,
    adBackedValueUsd: 0.005,
    inheritedValueUsd: 0.005, // Base tier
    pricedAtUsd: 0.005,
  },
  SILVER: {
    tier: 'SILVER',
    bronzeEquivalent: 20, // 1 Silver = 20 Bronze
    adBackedValueUsd: 0.10, // 20 × 0.005
    inheritedValueUsd: 0.10, // 0.005 × 20
    pricedAtUsd: 0.08, // Discounted
  },
  GOLD: {
    tier: 'GOLD',
    bronzeEquivalent: 400, // 20 × 20 = 400 Bronze
    adBackedValueUsd: 2.00, // 400 × 0.005
    inheritedValueUsd: 1.60, // 0.08 × 20
    pricedAtUsd: 1.50, // Discounted
  },
  EMERALD: {
    tier: 'EMERALD',
    bronzeEquivalent: 8000, // 400 × 20 = 8,000 Bronze
    adBackedValueUsd: 40.00, // 8,000 × 0.005
    inheritedValueUsd: 30.00, // 1.50 × 20
    pricedAtUsd: 25.00, // Discounted
  },
  SAPPHIRE: {
    tier: 'SAPPHIRE',
    bronzeEquivalent: 160000, // 8,000 × 20 = 160,000 Bronze
    adBackedValueUsd: 800.00, // 160,000 × 0.005
    inheritedValueUsd: 500.00, // 25.00 × 20
    pricedAtUsd: 420.00, // Discounted
  },
  RUBY: {
    tier: 'RUBY',
    bronzeEquivalent: 3200000, // 160,000 × 20 = 3,200,000 Bronze
    adBackedValueUsd: 16000.00, // 3,200,000 × 0.005
    inheritedValueUsd: 8400.00, // 420.00 × 20
    pricedAtUsd: 7500.00, // Discounted
  },
  AMETHYST: {
    tier: 'AMETHYST',
    bronzeEquivalent: 64000000, // 3,200,000 × 20 = 64,000,000 Bronze
    adBackedValueUsd: 320000.00, // 64,000,000 × 0.005
    inheritedValueUsd: 150000.00, // 7,500.00 × 20
    pricedAtUsd: 100000.00, // Discounted
  },
  DIAMOND: {
    tier: 'DIAMOND',
    bronzeEquivalent: 1280000000, // 64,000,000 × 20 = 1,280,000,000 Bronze
    adBackedValueUsd: 6400000.00, // 1,280,000,000 × 0.005
    inheritedValueUsd: 2000000.00, // 100,000.00 × 20
    pricedAtUsd: 1000000.00, // Discounted
  },
};

/**
 * Get economy configuration for a specific tier
 * @param {TicketTier} tier - The ticket tier
 * @returns {TierEconomyConfig} The economy configuration for the tier
 * @throws {Error} If tier is invalid
 */
function getTierConfig(tier) {
  const config = TIER_ECONOMY[tier];
  if (!config) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  return config;
}

/**
 * Convert a ticket amount to its bronze equivalent
 * @param {TicketTier} tier - The ticket tier
 * @param {number} amount - The amount of tickets
 * @returns {number} The bronze equivalent
 */
function getBronzeEquivalent(tier, amount) {
  const config = getTierConfig(tier);
  return config.bronzeEquivalent * amount;
}

/**
 * Get the ad-backed USD value for a ticket amount
 * This represents pure ad revenue math (bronzeEquivalent × $0.005)
 * @param {TicketTier} tier - The ticket tier
 * @param {number} amount - The amount of tickets
 * @returns {number} The ad-backed USD value
 */
function getAdBackedValueUsd(tier, amount) {
  const config = getTierConfig(tier);
  return config.adBackedValueUsd * amount;
}

/**
 * Get the priced USD value for a ticket amount
 * This is the "official" internal valuation (intentionally discounted)
 * @param {TicketTier} tier - The ticket tier
 * @param {number} amount - The amount of tickets
 * @returns {number} The priced USD value
 */
function getPricedValueUsd(tier, amount) {
  const config = getTierConfig(tier);
  return config.pricedAtUsd * amount;
}

/**
 * Get the inherited USD value for a ticket amount
 * This represents the ladder value (previous tier pricedAtUsd × 20)
 * @param {TicketTier} tier - The ticket tier
 * @param {number} amount - The amount of tickets
 * @returns {number} The inherited USD value
 */
function getInheritedValueUsd(tier, amount) {
  const config = getTierConfig(tier);
  return config.inheritedValueUsd * amount;
}

/**
 * Convert bronze equivalent to a specific tier
 * @param {number} bronzeAmount - Amount in bronze equivalent
 * @param {TicketTier} targetTier - Target tier to convert to
 * @returns {number} Amount in target tier (may be fractional)
 */
function convertBronzeToTier(bronzeAmount, targetTier) {
  const config = getTierConfig(targetTier);
  return bronzeAmount / config.bronzeEquivalent;
}

/**
 * Get all tier economy configurations
 * @returns {Record<TicketTier, TierEconomyConfig>} All tier economy configs
 */
function getAllTierConfigs() {
  return TIER_ECONOMY;
}

module.exports = {
  BASELINE_AD_REVENUE_USD,
  TIER_MULTIPLIER,
  TIER_ECONOMY,
  getTierConfig,
  getBronzeEquivalent,
  getAdBackedValueUsd,
  getPricedValueUsd,
  getInheritedValueUsd,
  convertBronzeToTier,
  getAllTierConfigs,
};

