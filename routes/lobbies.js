const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  joinLobby,
  chooseLuckyNumber,
  getLobbyState,
  getActiveLobbyState,
  postChatMessage,
  fetchChatMessages,
} = require('../lib/lobbyService');

router.use(requireAuth);

router.get('/active', async (req, res) => {
  try {
    const tier = (req.query.tier || 'BRONZE').toUpperCase();
    const lobby = await getActiveLobbyState({ tier, userId: req.user.id });
    res.json({ ok: true, lobby });
  } catch (error) {
    console.error('Error fetching active lobby:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to load lobby' });
  }
});

router.get('/:lobbyId/state', async (req, res) => {
  try {
    const lobby = await getLobbyState({ lobbyId: req.params.lobbyId, userId: req.user.id });
    res.json({ ok: true, lobby });
  } catch (error) {
    console.error('Error fetching lobby state:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to load lobby' });
  }
});

router.post('/:tier/join', async (req, res) => {
  try {
    const tier = req.params.tier.toUpperCase();
    const { luckyNumber } = req.body || {};
    const lobby = await joinLobby({
      tier,
      userId: req.user.id,
      luckyNumber,
    });
    res.json({ ok: true, lobby });
  } catch (error) {
    console.error('Error joining lobby:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to join lobby' });
  }
});

router.post('/:lobbyId/choose-number', async (req, res) => {
  try {
    const lobby = await chooseLuckyNumber({
      lobbyId: req.params.lobbyId,
      userId: req.user.id,
      luckyNumber: req.body?.luckyNumber,
    });
    res.json({ ok: true, lobby });
  } catch (error) {
    console.error('Error updating lucky number:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to update lucky number' });
  }
});

router.get('/:lobbyId/chat', async (req, res) => {
  try {
    const messages = await fetchChatMessages(req.params.lobbyId);
    const hydrated = messages.map(msg => ({
      ...msg,
      isYou: msg.userId === req.user.id,
    }));
    res.json({ ok: true, messages: hydrated });
  } catch (error) {
    console.error('Error fetching lobby chat:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to load chat' });
  }
});

router.post('/:lobbyId/chat', async (req, res) => {
  try {
    const message = await postChatMessage({
      lobbyId: req.params.lobbyId,
      userId: req.user.id,
      message: req.body?.message,
    });
    res.json({ ok: true, message });
  } catch (error) {
    console.error('Error posting lobby chat:', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to send message' });
  }
});

router.post('/:lobbyId/resolve', (req, res) => {
  res.status(410).json({
    ok: false,
    error: 'Client-side spin reporting has been deprecated. The server now resolves spins automatically.',
  });
});

module.exports = router;

