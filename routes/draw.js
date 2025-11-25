/**
 * Draw resolution routes
 * Handles tombola draw execution and winner selection
 * 
 * TODO: In future versions:
 * - Restrict draw start to admins only
 * - Add scheduled draws (automatic at specific times)
 * - Add websocket/real-time updates for multiple viewers
 * - Better house accounting system
 * - Protection against repeated draws on finished tombola
 * - More complex draw status persistence
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const prisma = require('../lib/prisma');

// All data access now uses Prisma - no JSON file loading needed
// House payouts are tracked in Draw records (housePayout field)

/**
 * POST /api/tombolas/:id/draw
 * Resolves the draw by randomly selecting a winner and awarding payouts
 * Auth: required, Admin only
 * 
 * This endpoint uses a Prisma transaction to ensure atomicity:
 * - Validates tombola is not already FINISHED
 * - Fetches all tickets in purchase order
 * - Randomly selects winner
 * - Atomically: creates Draw record, updates winner credits, creates CreditTransaction, updates tombola status
 * - Prevents duplicate draws on finished tombolas
 */
router.post('/:id/draw', requireAuth, requireAdmin, async (req, res) => {
  const tombolaId = req.params.id;
  const userId = req.user.id;
  
  try {
    // Use Prisma transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Load tombola and check if already finished
      const tombola = await tx.tombola.findUnique({
        where: { id: tombolaId },
      });
      
      if (!tombola) {
        throw new Error('Tombola not found');
      }
      
      // Check if there's already a finished draw for this tombola
      const existingDraw = await tx.draw.findFirst({
        where: {
          tombolaId: tombolaId,
          status: 'FINISHED',
        },
      });
      
      if (existingDraw) {
        throw new Error('Draw already finished.');
      }
      
      // Get all tickets for this tombola (in purchase order - oldest first)
      const tickets = await tx.ticket.findMany({
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
      
      if (tickets.length < 1) {
        throw new Error('No tickets to draw.');
      }
      
      // Randomly select winning ticket
      const totalTickets = tickets.length;
      const winningIndex = Math.floor(Math.random() * totalTickets);
      const winningTicket = tickets[winningIndex];
      
      // Calculate pot and payouts
      const pot = totalTickets; // Each ticket cost 1 credit
      const houseCutRatio = tombola.houseCutRatio;
      const winnerPayout = Math.floor(pot * (1 - houseCutRatio));
      const housePayout = pot - winnerPayout; // Ensures total aligns
      
      // Format ticket ID for winner
      const tombolaSlug = tombola.slug || tombolaId;
      const prefix = tombolaSlug.toUpperCase().substring(0, 3);
      const winnerTicketId = `${prefix}-${String(winningTicket.number).padStart(6, '0')}`;
      
      // Atomically: create Draw, update winner credits, create CreditTransaction, update tombola
      const [draw, updatedWinner] = await Promise.all([
        // Create Draw record
        tx.draw.create({
          data: {
            tombolaId: tombolaId,
            status: 'FINISHED',
            finishedAt: new Date(),
            potSize: pot,
            houseCutRatio: houseCutRatio,
            winnerTicketId: winningTicket.id,
            winnerUserId: winningTicket.userId,
            winnerPayout: winnerPayout,
            housePayout: housePayout,
          },
        }),
        
        // Update winner's credits
        tx.user.update({
          where: { id: winningTicket.userId },
          data: { credits: { increment: winnerPayout } },
        }),
      ]);
      
      // Create credit transaction for winner
      await tx.creditTransaction.create({
        data: {
          userId: winningTicket.userId,
          amount: winnerPayout,
          reason: 'DRAW_WIN',
          meta: {
            tombolaId: tombolaId,
            tombolaName: tombola.name,
            drawId: draw.id,
            ticketId: winningTicket.id,
          },
        },
      });
      
      // Update tombola status to FINISHED
      await tx.tombola.update({
        where: { id: tombolaId },
        data: { status: 'FINISHED' },
      });
      
      // Prepare tickets array in purchase order with isYou flags
      const ticketsWithFlags = tickets.map(ticket => {
        const ticketId = `${prefix}-${String(ticket.number).padStart(6, '0')}`;
        const publicName = ticket.user.publicName || ticket.user.id || 'Anonymous';
        
        return {
          ticketId: ticketId,
          publicName: publicName,
          createdAt: ticket.createdAt.toISOString(),
          isYou: ticket.userId === userId,
        };
      });
      
      return {
        tombola,
        draw,
        winnerTicket,
        winnerUser: updatedWinner,
        ticketsWithFlags,
        pot,
        winnerPayout,
        housePayout,
        winnerTicketId,
      };
    });
    
    // Return response for animation
    res.json({
      ok: true,
      tombolaId: tombolaId,
      winner: {
        ticketId: result.winnerTicketId,
        userId: result.winnerTicket.userId,
        publicName: result.winnerTicket.user.publicName || 'Anonymous',
        isYou: result.winnerTicket.userId === userId,
      },
      pot: {
        totalTickets: result.pot,
        winnerPayout: result.winnerPayout,
        housePayout: result.housePayout,
      },
      tickets: result.ticketsWithFlags,
      winnerUserNewBalance: result.winnerUser.credits,
    });
  } catch (error) {
    console.error('Draw resolution error:', error);
    
    // Handle known errors
    if (error.message === 'Tombola not found') {
      return res.status(404).json({ ok: false, error: error.message });
    }
    
    if (
      error.message.includes('already finished') ||
      error.message.includes('No tickets')
    ) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    
    // Unknown error
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;

