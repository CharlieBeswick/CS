/**
 * Tombola Store
 * CRUD operations for tombola management
 * 
 * TODO: In future versions:
 * - Replace with database (PostgreSQL, MongoDB, etc.)
 * - Add soft delete functionality
 * - Add pagination and filtering
 * - Add search functionality
 */

const fs = require('fs');
const path = require('path');

const tombolasFilePath = path.join(__dirname, '..', 'data', 'tombolas.json');

/**
 * Load all tombolas from file
 */
function loadTombolas() {
  try {
    if (fs.existsSync(tombolasFilePath)) {
      const data = fs.readFileSync(tombolasFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading tombolas:', err);
  }
  return [];
}

/**
 * Save tombolas to file
 */
function saveTombolas(tombolas) {
  try {
    fs.writeFileSync(tombolasFilePath, JSON.stringify(tombolas, null, 2));
  } catch (err) {
    console.error('Error saving tombolas:', err);
    throw err;
  }
}

/**
 * Generate a unique ID from name
 */
function generateId(name) {
  // Slugify: lowercase, replace spaces with hyphens, remove special chars
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  // Check for collisions and append number if needed
  const existing = loadTombolas();
  let finalId = slug;
  let counter = 1;
  
  while (existing.some(t => t.id === finalId)) {
    finalId = `${slug}-${counter}`;
    counter++;
  }
  
  return finalId;
}

/**
 * Get all tombolas
 */
function getAllTombolas() {
  return loadTombolas();
}

/**
 * Get tombola by ID
 */
function getTombolaById(id) {
  const tombolas = loadTombolas();
  return tombolas.find(t => t.id === id);
}

/**
 * Create a new tombola
 */
function createTombola(data) {
  const tombolas = loadTombolas();
  
  // Validate required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new Error('Name is required');
  }
  
  // Generate ID
  const id = generateId(data.name);
  
  // Create tombola object
  const now = new Date().toISOString();
  const tombola = {
    id: id,
    name: data.name.trim(),
    prize: data.prize || '',
    status: data.status || 'DRAFT',
    description: data.description || '',
    houseCutRatio: data.houseCutRatio !== undefined ? data.houseCutRatio : 0.2,
    startTime: data.startTime || null,
    endTime: data.endTime || null,
    createdAt: now,
    updatedAt: now,
    // Legacy fields for compatibility
    timeLeftSeconds: 0,
    totalTickets: 0,
    publicTickets: [],
    // Draw state fields
    drawState: 'OPEN',
    winnerTicketId: null,
    winnerUserId: null,
    winnerPublicName: null,
    potSize: null,
    winnerPayout: null,
    housePayout: null,
  };
  
  // Validate status
  const validStatuses = ['DRAFT', 'LIVE', 'PENDING', 'FINISHED'];
  if (!validStatuses.includes(tombola.status)) {
    throw new Error('Invalid status');
  }
  
  // Validate houseCutRatio
  if (tombola.houseCutRatio < 0 || tombola.houseCutRatio > 0.9) {
    throw new Error('House cut ratio must be between 0 and 0.9');
  }
  
  // Add to array
  tombolas.push(tombola);
  saveTombolas(tombolas);
  
  return tombola;
}

/**
 * Update tombola
 */
function updateTombola(id, updates) {
  const tombolas = loadTombolas();
  const index = tombolas.findIndex(t => t.id === id);
  
  if (index === -1) {
    throw new Error('Tombola not found');
  }
  
  const tombola = tombolas[index];
  
  // Allowed fields to update
  const allowedFields = ['name', 'prize', 'status', 'description', 'houseCutRatio', 'startTime', 'endTime'];
  
  // Apply updates
  for (const key of allowedFields) {
    if (updates.hasOwnProperty(key)) {
      if (key === 'name' && updates.name) {
        tombola.name = updates.name.trim();
      } else if (key === 'houseCutRatio') {
        // Clamp between 0 and 0.9
        const ratio = Math.max(0, Math.min(0.9, updates.houseCutRatio));
        tombola.houseCutRatio = ratio;
      } else if (key === 'status') {
        const validStatuses = ['DRAFT', 'LIVE', 'PENDING', 'FINISHED'];
        if (validStatuses.includes(updates.status)) {
          tombola.status = updates.status;
        }
      } else {
        tombola[key] = updates[key];
      }
    }
  }
  
  // Update timestamp
  tombola.updatedAt = new Date().toISOString();
  
  // Save
  saveTombolas(tombolas);
  
  return tombola;
}

/**
 * Delete tombola (only if no tickets)
 */
function deleteTombola(id) {
  const ticketStore = require('../data/ticketStore');
  const tickets = ticketStore.getTicketsForTombola(id);
  
  if (tickets.length > 0) {
    throw new Error('Cannot delete tombola with existing tickets');
  }
  
  const tombolas = loadTombolas();
  const filtered = tombolas.filter(t => t.id !== id);
  
  if (filtered.length === tombolas.length) {
    throw new Error('Tombola not found');
  }
  
  saveTombolas(filtered);
  return true;
}

module.exports = {
  getAllTombolas,
  getTombolaById,
  createTombola,
  updateTombola,
  deleteTombola,
};

