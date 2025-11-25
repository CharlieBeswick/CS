/**
 * Ticket Store
 * Simple data access layer for ticket entries
 * 
 * TODO: Replace with database in future versions
 */

const fs = require('fs');
const path = require('path');

const ticketsFilePath = path.join(__dirname, 'tickets.json');

/**
 * Load all tickets from file
 */
function loadTickets() {
  try {
    if (fs.existsSync(ticketsFilePath)) {
      const data = fs.readFileSync(ticketsFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading tickets:', err);
  }
  return {};
}

/**
 * Save tickets to file
 */
function saveTickets(tickets) {
  try {
    fs.writeFileSync(ticketsFilePath, JSON.stringify(tickets, null, 2));
  } catch (err) {
    console.error('Error saving tickets:', err);
    throw err;
  }
}

/**
 * Get all tickets for a specific tombola
 */
function getTicketsForTombola(tombolaId) {
  const tickets = loadTickets();
  return tickets[tombolaId] || [];
}

/**
 * Add a ticket to a tombola
 */
function addTicket(tombolaId, ticket) {
  const tickets = loadTickets();
  
  if (!tickets[tombolaId]) {
    tickets[tombolaId] = [];
  }
  
  tickets[tombolaId].push(ticket);
  saveTickets(tickets);
  
  return ticket;
}

/**
 * Count tickets for a specific user in a tombola
 */
function countTicketsForUser(tombolaId, userId) {
  const tickets = getTicketsForTombola(tombolaId);
  return tickets.filter(t => t.userId === userId).length;
}

/**
 * Generate next ticket ID for a tombola
 * Format: PREFIX-000001, PREFIX-000002, etc.
 */
function generateTicketId(tombolaId) {
  const tickets = getTicketsForTombola(tombolaId);
  const nextNumber = tickets.length + 1;
  
  // Generate prefix from tombola ID (first 3 uppercase letters)
  const prefix = tombolaId
    .split('-')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3) || 'TOM';
  
  // Pad to 6 digits
  const paddedNumber = String(nextNumber).padStart(6, '0');
  
  return `${prefix}-${paddedNumber}`;
}

module.exports = {
  getTicketsForTombola,
  addTicket,
  countTicketsForUser,
  generateTicketId,
  loadTickets,
  saveTickets,
};

