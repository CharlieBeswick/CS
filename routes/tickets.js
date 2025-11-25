/**
 * Tickets routes
 * Handles ticket/credits balance and reward distribution
 * 
 * TODO: In future versions:
 * - Add daily limits for ad rewards (e.g., max 20 ad_demo rewards per day per user)
 * - Integrate with real Google AdMob callbacks
 * - Add reward history tracking
 * - Add other reward types (daily login, referrals, etc.)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();

// Reward constants
const AD_DEMO_REWARD = 10;

// User store (shared with auth.js and profile.js)
const usersFilePath = path.join(__dirname, '..', 'data', 'users.json');

// Load users from file
function loadUsers() {
  try {
    if (fs.existsSync(usersFilePath)) {
      const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
      const users = {};
      usersData.forEach(user => {
        users[user.id] = user;
      });
      return users;
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
  return {};
}

// Save users to file
function saveUsers(users) {
  try {
    const usersArray = Object.values(users);
    fs.writeFileSync(usersFilePath, JSON.stringify(usersArray, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

/**
 * GET /api/tickets
 * Returns the current user's ticket/credits balance
 */
router.get('/', requireAuth, (req, res) => {
  const users = loadUsers();
  const user = users[req.session.userId];
  
  if (!user) {
    return res.status(404).json({ ok: false, error: 'User not found' });
  }

  const credits = typeof user.credits === 'number' ? user.credits : 0;

  res.json({
    ok: true,
    credits,
  });
});

/**
 * POST /api/tickets/reward
 * Awards credits for a reward action (e.g., watching an ad)
 * 
 * Body: { type: "ad_demo" }
 * 
 * TODO: Add daily limits per reward type
 * TODO: Integrate with real ad callbacks (Google AdMob)
 * TODO: Add reward history logging
 */
router.post('/reward', requireAuth, (req, res) => {
  const { type } = req.body;

  if (!type || typeof type !== 'string') {
    return res.status(400).json({ ok: false, error: 'Reward type is required' });
  }

  // Validate reward type
  if (type !== 'ad_demo') {
    return res.status(400).json({ ok: false, error: 'Invalid reward type' });
  }

  const users = loadUsers();
  const user = users[req.session.userId];

  if (!user) {
    return res.status(404).json({ ok: false, error: 'User not found' });
  }

  // TODO: Check daily limits here
  // Example: if (getAdRewardsToday(user.id) >= MAX_DAILY_AD_REWARDS) {
  //   return res.status(429).json({ ok: false, error: 'Daily limit reached' });
  // }

  // Initialize credits if needed
  if (typeof user.credits !== 'number') {
    user.credits = 0;
  }

  // Award credits based on type
  let creditsAwarded = 0;
  if (type === 'ad_demo') {
    creditsAwarded = AD_DEMO_REWARD;
    user.credits += creditsAwarded;
  }

  // TODO: Log reward to history
  // Example: addRewardHistory(user.id, { type, creditsAwarded, timestamp: new Date() });

  // Save updated user
  users[req.session.userId] = user;
  saveUsers(users);

  res.json({
    ok: true,
    creditsAwarded,
    newBalance: user.credits,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      publicName: user.publicName || user.name,
      avatarUrl: user.avatarUrl || user.picture,
      credits: user.credits,
    },
  });
});

module.exports = router;

