/**
 * Tombola routes
 * Handles listing and details of tombolas
 * 
 * TODO: In future versions:
 * - Add POST /api/tombolas/:id/enter for entering draws
 * - Add GET /api/tombolas/:id/public-board for public ticket board
 * - Add authentication requirement (requireAuth middleware)
 * - Add real-time updates via WebSockets or SSE
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

/**
 * GET /api/tombolas
 * Returns the list of tombolas visible to players
 * Only shows LIVE and PENDING tombolas
 * 
 * TODO: Add pagination, filtering by status, sorting
 * TODO: Require authentication in future versions
 */
router.get('/', async (req, res) => {
  try {
    const visibleTombolas = await prisma.tombola.findMany({
      where: {
        status: {
          in: ['LIVE', 'PENDING'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(visibleTombolas);
  } catch (error) {
    console.error('Error fetching tombolas:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch tombolas' });
  }
});

/**
 * GET /api/tombolas/:id
 * Returns details for a specific tombola
 * 
 * TODO: Add public ticket board data
 * TODO: Add winner information for finished tombolas
 */
router.get('/:id', async (req, res) => {
  try {
    const tombola = await prisma.tombola.findUnique({
      where: { id: req.params.id },
    });
    
    if (!tombola) {
      return res.status(404).json({ ok: false, error: 'Tombola not found' });
    }
    
    res.json(tombola);
  } catch (error) {
    console.error('Error fetching tombola:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch tombola' });
  }
});

/**
 * Note: POST /api/tombolas/:id/enter and GET /api/tombolas/:id/board
 * are now handled by routes/board.js
 */

module.exports = router;

