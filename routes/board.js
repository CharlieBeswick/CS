/**
 * Ticket Board routes
 * Handles ticket board display and entry
 * 
 * TODO: In future versions:
 * - Add winner selection logic
 * - Add real-time updates via WebSockets
 * - Add daily limits per user per tombola
 * - Add fraud prevention (rate limiting, etc.)
 * - Add max entries per user per tombola
 */

const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const prisma = require('../lib/prisma');
const { MAX_TICKETS_PER_USER_PER_TOMBOLA } = require('../config/limits');

// All data access now uses Prisma - no JSON file loading needed

/**
 * GET /api/tombolas/:id/board
 * Returns the ticket board for a given tombola
 * Auth: optional (board is public)
 */
router.get('/:id/board', optionalAuth, async (req, res) => {
  const tombolaId = req.params.id;
  const userId = req.user?.id || null;
  
  try {
    // Validate tombola exists
    const tombola = await prisma.tombola.findUnique({
      where: { id: tombolaId },
    });
    
    if (!tombola) {
      return res.status(404).json({ ok: false, error: 'Tombola not found' });
    }
    
    // Get all tickets for this tombola, ordered by number (purchase order)
    const allTickets = await prisma.ticket.findMany({
      where: { tombolaId },
      include: {
        user: {
          select: {
            id: true,
            publicName: true,
          },
        },
      },
      orderBy: { number: 'asc' },
    });
    
    // For board view, show newest first; for game, we'll use original order (oldest first)
    // Sort by newest first for board display
    const sortedTickets = [...allTickets].sort((a, b) => {
      return b.createdAt - a.createdAt;
    });
    
    // Format ticket ID and mark user's tickets
    let yourTicketCount = 0;
    const tombolaSlug = tombola.slug || tombolaId;
    const prefix = tombolaSlug.toUpperCase().substring(0, 3);
    
    const ticketsWithFlags = sortedTickets.map(ticket => {
      const isYou = userId && ticket.userId === userId;
      if (isYou) {
        yourTicketCount++;
      }
      
      const ticketId = `${prefix}-${String(ticket.number).padStart(6, '0')}`;
      const publicName = ticket.user.publicName || ticket.user.id || 'Anonymous';
      
      return {
        ticketId: ticketId,
        publicName: publicName,
        isYou: isYou,
        createdAt: ticket.createdAt.toISOString(),
      };
    });
    
    res.json({
      ok: true,
      tombolaId: tombolaId,
      totalTickets: allTickets.length,
      yourTicketCount: yourTicketCount,
      tickets: ticketsWithFlags,
    });
  } catch (error) {
    console.error('Error loading ticket board:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/tombolas/:id/enter
 * Use 1 credit to enter the tombola and receive a ticket
 * Auth: required
 * 
 * This endpoint uses a Prisma transaction to ensure atomicity:
 * - Validates tombola status (must be LIVE or PENDING)
 * - Checks user credits (must be >= 1)
 * - Enforces MAX_TICKETS_PER_USER_PER_TOMBOLA limit
 * - Atomically decrements credits, creates CreditTransaction, and creates Ticket
 */
router.post('/:id/enter', requireAuth, async (req, res) => {
  const tombolaId = req.params.id;
  const userId = req.user.id;
  
  try {
    // Use Prisma transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Load tombola and validate status (store for return)
      const tombola = await tx.tombola.findUnique({
        where: { id: tombolaId },
      });
      
      if (!tombola) {
        throw new Error('Tombola not found');
      }
      
      if (tombola.status === 'FINISHED') {
        throw new Error('This tombola has finished. Entries are closed.');
      }
      
      if (tombola.status !== 'LIVE' && tombola.status !== 'PENDING') {
        throw new Error('This tombola is not accepting entries.');
      }
      
      // Load user and check credits
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.credits < 1) {
        throw new Error('Not enough tickets');
      }
      
      // Check existing tickets for this user and tombola
      const existingTicketCount = await tx.ticket.count({
        where: {
          tombolaId: tombolaId,
          userId: userId,
        },
      });
      
      if (existingTicketCount >= MAX_TICKETS_PER_USER_PER_TOMBOLA) {
        throw new Error(`Maximum tickets per user (${MAX_TICKETS_PER_USER_PER_TOMBOLA}) reached for this tombola.`);
      }
      
      // Get the next ticket number for this tombola
      const lastTicket = await tx.ticket.findFirst({
        where: { tombolaId },
        orderBy: { number: 'desc' },
      });
      
      const nextNumber = lastTicket ? lastTicket.number + 1 : 1;
      
      // Get user's public name (snapshot at time of entry)
      const publicName = user.publicName || user.name || 'Anonymous';
      
      // Atomically: decrement credits, create transaction, create ticket
      const [updatedUser, creditTransaction, ticket] = await Promise.all([
        // Decrement user credits
        tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: 1 } },
        }),
        
        // Create credit transaction record
        tx.creditTransaction.create({
          data: {
            userId: userId,
            amount: -1,
            reason: 'ENTER_TOMBOLA',
            meta: { tombolaId, tombolaName: tombola.name },
          },
        }),
        
        // Create ticket
        tx.ticket.create({
          data: {
            tombolaId: tombolaId,
            userId: userId,
            number: nextNumber,
          },
        }),
      ]);
      
      // Get updated counts
      const [yourTicketCount, totalTickets] = await Promise.all([
        tx.ticket.count({
          where: {
            tombolaId: tombolaId,
            userId: userId,
          },
        }),
        tx.ticket.count({
          where: { tombolaId: tombolaId },
        }),
      ]);
      
      return {
        user: updatedUser,
        ticket,
        tombola: { id: tombola.id, slug: tombola.slug },
        yourTicketCount,
        totalTickets,
        publicName,
      };
    });
    
    // Format ticket ID for response (e.g., "MID-000001")
    const tombolaSlug = result.tombola.slug || tombolaId;
    const prefix = tombolaSlug.toUpperCase().substring(0, 3);
    const ticketId = `${prefix}-${String(result.ticket.number).padStart(6, '0')}`;
    
    res.json({
      ok: true,
      ticket: {
        ticketId: ticketId,
        publicName: result.publicName,
        createdAt: result.ticket.createdAt.toISOString(),
        isYou: true,
      },
      newBalance: result.user.credits,
      yourTicketCount: result.yourTicketCount,
      totalTickets: result.totalTickets,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        picture: result.user.picture,
        publicName: result.user.publicName,
        avatarUrl: result.user.avatarUrl,
        credits: result.user.credits,
      },
    });
  } catch (error) {
    console.error('Error entering tombola:', error);
    
    // Handle known errors
    if (error.message === 'Tombola not found' || error.message === 'User not found') {
      return res.status(404).json({ ok: false, error: error.message });
    }
    
    if (
      error.message.includes('finished') ||
      error.message.includes('not accepting') ||
      error.message.includes('Not enough') ||
      error.message.includes('Maximum tickets')
    ) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    
    // Unknown error
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;

