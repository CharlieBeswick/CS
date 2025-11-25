/**
 * Profile routes
 * Handles user profile management (publicName, avatarUrl, credits)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();

// User store (shared with auth.js)
// In a real app, this would be a proper database or service
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
 * GET /api/profile
 * Returns the current user's profile
 */
router.get('/', requireAuth, (req, res) => {
  const users = loadUsers();
  const user = users[req.session.userId];
  
  if (!user) {
    return res.status(404).json({ ok: false, error: 'User not found' });
  }

  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      publicName: user.publicName || user.name,
      avatarUrl: user.avatarUrl || user.picture,
      credits: typeof user.credits === 'number' ? user.credits : 0,
    },
  });
});

/**
 * PUT /api/profile
 * Updates the current user's profile (publicName, avatarUrl)
 */
router.put('/', requireAuth, (req, res) => {
  const { publicName, avatarUrl } = req.body;

  if (!publicName || typeof publicName !== 'string' || publicName.trim().length === 0) {
    return res.status(400).json({ ok: false, error: 'Public name is required' });
  }

  const users = loadUsers();
  const user = users[req.session.userId];

  if (!user) {
    return res.status(404).json({ ok: false, error: 'User not found' });
  }

  // Update user profile
  user.publicName = publicName.trim();
  user.avatarUrl = avatarUrl && avatarUrl.trim() ? avatarUrl.trim() : null;
  
  // Ensure credits field exists
  if (typeof user.credits !== 'number') {
    user.credits = 0;
  }

  // Save to file
  users[req.session.userId] = user;
  saveUsers(users);

  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      publicName: user.publicName,
      avatarUrl: user.avatarUrl,
      credits: user.credits,
    },
  });
});

module.exports = router;

