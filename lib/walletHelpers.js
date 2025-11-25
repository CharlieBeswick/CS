/**
 * Wallet Helper Functions
 * Centralized access to user ticket wallets
 * 
 * All wallet operations should go through these helpers to ensure:
 * - Validation of tiers
 * - Prevention of negative balances
 * - Consistent data structure
 */

const prisma = require('./prisma');
const { TICKET_TIERS, isValidTier, createEmptyWallet } = require('../config/tickets');

/**
 * Get user's ticket wallet
 * Returns wallet object with all 8 tiers, initializing if needed
 */
async function getUserWallet(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ticketWallet: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // If wallet doesn't exist, initialize it
  if (!user.ticketWallet || typeof user.ticketWallet !== 'object') {
    const emptyWallet = createEmptyWallet();
    await prisma.user.update({
      where: { id: userId },
      data: { ticketWallet: emptyWallet },
    });
    return emptyWallet;
  }

  // Ensure all tiers exist in wallet (migration safety)
  const wallet = { ...user.ticketWallet };
  let needsUpdate = false;
  
  TICKET_TIERS.forEach(tier => {
    if (typeof wallet[tier] !== 'number') {
      wallet[tier] = 0;
      needsUpdate = true;
    }
  });

  if (needsUpdate) {
    await prisma.user.update({
      where: { id: userId },
      data: { ticketWallet: wallet },
    });
  }

  return wallet;
}

/**
 * Add tickets to user's wallet
 * @param {string} userId - User ID
 * @param {string} tier - Ticket tier (BRONZE, SILVER, etc.)
 * @param {number} amount - Amount to add (must be positive)
 * @param {string} reason - Reason for adding (for transaction log)
 * @param {object} meta - Optional metadata for transaction
 * @returns {Promise<object>} Updated wallet
 */
async function addTickets(userId, tier, amount, reason = 'MANUAL', meta = {}) {
  if (!isValidTier(tier)) {
    throw new Error(`Invalid ticket tier: ${tier}`);
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const wallet = await getUserWallet(userId);

  // Update wallet
  const newBalance = (wallet[tier] || 0) + amount;
  const updatedWallet = {
    ...wallet,
    [tier]: newBalance,
  };

  // Persist wallet update and create transaction log in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { ticketWallet: updatedWallet },
    });

    await tx.creditTransaction.create({
      data: {
        userId: userId,
        amount: amount,
        reason: reason,
        tier: tier,
        meta: {
          ...meta,
          operation: 'ADD',
        },
      },
    });
  });

  return updatedWallet;
}

/**
 * Consume (remove) tickets from user's wallet
 * @param {string} userId - User ID
 * @param {string} tier - Ticket tier (BRONZE, SILVER, etc.)
 * @param {number} amount - Amount to consume (must be positive)
 * @param {string} reason - Reason for consuming (for transaction log)
 * @param {object} meta - Optional metadata for transaction
 * @returns {Promise<object>} Updated wallet
 * @throws {Error} If user doesn't have enough tickets
 */
async function consumeTickets(userId, tier, amount, reason = 'MANUAL', meta = {}) {
  if (!isValidTier(tier)) {
    throw new Error(`Invalid ticket tier: ${tier}`);
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const wallet = await getUserWallet(userId);
  const currentBalance = wallet[tier] || 0;

  if (currentBalance < amount) {
    throw new Error(`Insufficient ${tier} tickets. Required: ${amount}, Available: ${currentBalance}`);
  }

  // Update wallet
  const newBalance = currentBalance - amount;
  const updatedWallet = {
    ...wallet,
    [tier]: newBalance,
  };

  // Persist wallet update and create transaction log in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { ticketWallet: updatedWallet },
    });

    await tx.creditTransaction.create({
      data: {
        userId: userId,
        amount: -amount, // Negative for consumption
        reason: reason,
        tier: tier,
        meta: {
          ...meta,
          operation: 'CONSUME',
        },
      },
    });
  });

  return updatedWallet;
}

/**
 * Get total ticket count across all tiers
 */
async function getTotalTickets(userId) {
  const wallet = await getUserWallet(userId);
  return TICKET_TIERS.reduce((sum, tier) => sum + (wallet[tier] || 0), 0);
}

module.exports = {
  getUserWallet,
  addTickets,
  consumeTickets,
  getTotalTickets,
};

