/**
 * Tier Queue Configuration
 * 
 * Defines the queue structure for tier-based games.
 * 
 * For each tier 1-7 (BRONZE to AMETHYST), there are 3 queue sizes:
 * - Small: 20 players → winner gets 1 next-tier ticket
 * - Medium: 40 players → winner gets 2 next-tier tickets
 * - Large: 60 players → winner gets 3 next-tier tickets
 * 
 * Entry cost: Always 1 ticket of the current tier per player per game
 * (staked and then burned when game runs)
 * 
 * TODO: Implement actual queue state storage (DB model) for each TierQueueConfig.
 * TODO: Implement logic to join a queue, reserve a ticket, and start a game when full.
 * TODO: Implement fair winner selection and ticket burning using TIER_ECONOMY and QUEUE_CONFIGS.
 */

const { TICKET_TIERS, getNextTier } = require('./tickets');

/**
 * Queue Size Type
 * @typedef {(20|40|60)} QueueSize
 */

/**
 * Tier Queue Configuration
 * @typedef {Object} TierQueueConfig
 * @property {string} tier - The ticket tier (e.g. "BRONZE", "SILVER")
 * @property {QueueSize} queueSize - Number of players required (20, 40, or 60)
 * @property {number} rewardNextTierAmount - Number of next-tier tickets awarded (1, 2, or 3)
 */

/**
 * Valid queue sizes
 */
const QUEUE_SIZES = [20, 40, 60];

/**
 * Queue size labels
 */
const QUEUE_SIZE_LABELS = {
  20: 'Small',
  40: 'Medium',
  60: 'Large',
};

/**
 * Reward amounts per queue size
 */
const QUEUE_REWARDS = {
  20: 1, // Small queue → 1 next-tier ticket
  40: 2, // Medium queue → 2 next-tier tickets
  60: 3, // Large queue → 3 next-tier tickets
};

/**
 * Generate all queue configurations for tiers 1-7
 * Tier 8 (DIAMOND) has no next tier, so no queues
 */
function generateQueueConfigs() {
  const configs = [];
  
  // Tiers 1-7 (BRONZE to AMETHYST)
  for (let i = 0; i < TICKET_TIERS.length - 1; i++) {
    const tier = TICKET_TIERS[i];
    const nextTier = TICKET_TIERS[i + 1];
    
    // Create 3 queue configs per tier (Small, Medium, Large)
    QUEUE_SIZES.forEach(size => {
      configs.push({
        tier: tier,
        nextTier: nextTier,
        queueSize: size,
        rewardNextTierAmount: QUEUE_REWARDS[size],
        label: `${QUEUE_SIZE_LABELS[size]} (${size} players)`,
      });
    });
  }
  
  return configs;
}

/**
 * All queue configurations
 * Generated automatically for tiers 1-7
 */
const QUEUE_CONFIGS = generateQueueConfigs();

/**
 * Get all queue configurations for a specific tier
 * @param {string} tier - The ticket tier
 * @returns {TierQueueConfig[]} Array of queue configs for that tier
 */
function getQueuesForTier(tier) {
  return QUEUE_CONFIGS.filter(config => config.tier === tier);
}

/**
 * Get a specific queue configuration
 * @param {string} tier - The ticket tier
 * @param {QueueSize} queueSize - The queue size (20, 40, or 60)
 * @returns {TierQueueConfig|null} The queue config, or null if not found
 */
function getQueueConfig(tier, queueSize) {
  return QUEUE_CONFIGS.find(
    config => config.tier === tier && config.queueSize === queueSize
  ) || null;
}

/**
 * Get the next tier for a given tier
 * @param {string} tier - The current tier
 * @returns {string|null} The next tier, or null if DIAMOND (no next tier)
 */
function getNextTierForQueue(tier) {
  return getNextTier(tier);
}

/**
 * Validate if a queue size is valid
 * @param {number} size - The queue size to validate
 * @returns {boolean} True if valid (20, 40, or 60)
 */
function isValidQueueSize(size) {
  return QUEUE_SIZES.includes(size);
}

/**
 * Get queue size label
 * @param {QueueSize} size - The queue size
 * @returns {string} The label (Small, Medium, or Large)
 */
function getQueueSizeLabel(size) {
  return QUEUE_SIZE_LABELS[size] || 'Unknown';
}

/**
 * Get reward amount for a queue size
 * @param {QueueSize} size - The queue size
 * @returns {number} The reward amount (1, 2, or 3)
 */
function getRewardAmount(size) {
  return QUEUE_REWARDS[size] || 0;
}

/**
 * Get all queue configurations
 * @returns {TierQueueConfig[]} All queue configurations
 */
function getAllQueueConfigs() {
  return QUEUE_CONFIGS;
}

/**
 * Get queue configurations grouped by tier
 * @returns {Record<string, TierQueueConfig[]>} Queue configs grouped by tier
 */
function getQueuesByTier() {
  const grouped = {};
  TICKET_TIERS.forEach(tier => {
    if (tier !== 'DIAMOND') {
      grouped[tier] = getQueuesForTier(tier);
    }
  });
  return grouped;
}

module.exports = {
  QUEUE_SIZES,
  QUEUE_SIZE_LABELS,
  QUEUE_REWARDS,
  QUEUE_CONFIGS,
  getQueuesForTier,
  getQueueConfig,
  getNextTierForQueue,
  isValidQueueSize,
  getQueueSizeLabel,
  getRewardAmount,
  getAllQueueConfigs,
  getQueuesByTier,
};

