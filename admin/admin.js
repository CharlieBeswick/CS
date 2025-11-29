/**
 * Crypto Snow Admin Panel
 * Clean admin dashboard skeleton
 */

// API base URL - use Railway backend URL in production, or localhost for development
// This ensures the admin panel works correctly whether accessed from the backend URL or frontend URL
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://perpetual-reprieve-try3.up.railway.app';

/**
 * Initialize admin panel
 */
async function init() {
  // Check admin access
  await checkAdminAccess();
  
  // Set up navigation
  setupNavigation();
  
  // Load initial page
  showPage('dashboard');
  
  // Note: Sign out handler is set up in checkAdminAccess after email is loaded
}

/**
 * Check if user has admin access
 */
async function checkAdminAccess() {
  try {
    console.log('[Admin] Checking admin access, API_BASE:', API_BASE);
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    
    console.log('[Admin] Auth check response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        showNoAdminAccess('Not authenticated. Please sign in on the main app (cryptosnow.app) first, then try accessing the admin panel again.');
      } else {
        showNoAdminAccess(`Authentication error (${response.status}). Please try again.`);
      }
      return false;
    }
    
    const data = await response.json();
    console.log('[Admin] Auth check data:', data);
    
    if (!data.ok || !data.user) {
      showNoAdminAccess('Not authenticated. Please sign in on the main app (cryptosnow.app) first, then try accessing the admin panel again.');
      return false;
    }
    
    // Update user email display
    const emailEl = document.getElementById('admin-user-email');
    if (emailEl) {
      emailEl.textContent = data.user.email;
      // Set up sign out handler after email is set
      setupSignOutHandler(emailEl);
    }
    
    // Check if user has admin role
    if (!data.user.role || data.user.role !== 'ADMIN') {
      console.warn('[Admin] User does not have ADMIN role:', { email: data.user.email, role: data.user.role });
      showNoAdminAccess(`You are signed in as ${data.user.email}, but your account does not have admin rights. Your current role is: ${data.user.role || 'none'}. Please contact the system administrator.`);
      return false;
    }
    
    console.log('[Admin] Admin access granted for:', data.user.email);
    // User has ADMIN role, allow access
    // Note: The backend route also checks admin access, so this is just a frontend check
    return true;
  } catch (error) {
    console.error('[Admin] Admin access check error:', error);
    showNoAdminAccess(`Error checking admin access: ${error.message}. Make sure you are signed in on the main app first.`);
    return false;
  }
}

/**
 * Show no admin access message
 */
function showNoAdminAccess(message) {
  const container = document.querySelector('.admin-container');
  const noAccess = document.getElementById('no-admin-access');
  const messageEl = document.getElementById('no-admin-message');
  
  if (container) container.style.display = 'none';
  if (noAccess) {
    noAccess.style.display = 'flex';
    if (messageEl) {
      messageEl.textContent = message;
      // Add helpful message about signing in
      const helpText = document.createElement('p');
      helpText.style.marginTop = '1rem';
      helpText.style.color = 'var(--admin-text-muted)';
      helpText.style.fontSize = '0.9rem';
      helpText.textContent = 'Tip: Make sure you are signed in on the main app (cryptosnow.app) first, then access the admin panel.';
      messageEl.parentElement.appendChild(helpText);
    }
  }
}

/**
 * Set up navigation
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.admin-nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Update active nav item
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Show corresponding page
      const page = item.dataset.page;
      showPage(page);
    });
  });
}

/**
 * Show a specific page
 */
function showPage(pageName) {
  // Hide all pages
  const pages = document.querySelectorAll('.admin-page');
  pages.forEach(page => {
    page.classList.remove('active');
  });
  
  // Show selected page
  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // Load page data if needed
  loadPageData(pageName);
}

/**
 * Load data for a specific page
 */
async function loadPageData(pageName) {
  // TODO: Implement data loading for each page
  console.log(`Loading data for page: ${pageName}`);
  
  switch (pageName) {
    case 'dashboard':
      await loadAdminDashboard();
      break;
    case 'withdrawals':
      await loadWithdrawals();
      break;
    case 'users':
      await loadAdminUsers();
      break;
    case 'game-history':
      await loadAdminGameHistory();
      break;
    case 'current-lobbies':
      if (!lobbyFiltersInitialized) {
        setupLobbyFilterHandlers();
        lobbyFiltersInitialized = true;
      }
      await loadAdminLobbies();
      break;
    case 'tier-pyramid':
      // TODO: Load tier pyramid data
      break;
  }
}

/**
 * Load withdrawal requests for admin inbox
 */
let currentWithdrawalFilter = 'all';
let currentLobbyFilters = { tier: '', status: 'WAITING', days: '1' }; // Show only WAITING lobbies by default
let selectedLobbyId = null;
let lobbyFiltersInitialized = false;

async function loadAdminDashboard() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/summary`, {
      credentials: 'include',
    });
    
    const data = await response.json();
    
    if (data.ok) {
      renderAdminDashboard(data);
    } else {
      document.getElementById('adminDashboardStats').innerHTML = 
        `<div class="admin-error">Failed to load dashboard: ${data.error || 'Unknown error'}</div>`;
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    document.getElementById('adminDashboardStats').innerHTML = 
      '<div class="admin-error">Error loading dashboard. Please refresh the page.</div>';
  }
}

function renderAdminDashboard(stats) {
  const container = document.getElementById('adminDashboardStats');
  if (!container) return;

  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'DIAMOND'];
  const tierColors = {
    BRONZE: '#CD7F32',
    SILVER: '#C0C0C0',
    GOLD: '#FFD700',
    EMERALD: '#50C878',
    SAPPHIRE: '#0F52BA',
    RUBY: '#E0115F',
    AMETHYST: '#9966CC',
    DIAMOND: '#B9F2FF',
  };

  container.innerHTML = `
    <div class="admin-stats-grid">
      <div class="admin-stat-card">
        <div class="admin-stat-label">Games Run</div>
        <div class="admin-stat-value">${stats.totalGames || 0}</div>
      </div>
      
      <div class="admin-stat-card">
        <div class="admin-stat-label">Ads Viewed</div>
        <div class="admin-stat-value">${stats.totalAdsViewed || 0}</div>
      </div>
      
      <div class="admin-stat-card">
        <div class="admin-stat-label">Total Players</div>
        <div class="admin-stat-value">${stats.totalPlayers || 0}</div>
      </div>
      
      <div class="admin-stat-card">
        <div class="admin-stat-label">Live Players</div>
        <div class="admin-stat-value">${stats.livePlayers || 0}</div>
        <div class="admin-stat-subtitle">(Last 10 minutes)</div>
      </div>
    </div>
    
    <div class="admin-dashboard-section" style="margin-top: 2rem;">
      <h3 class="admin-dashboard-section-title" style="font-size: 1.2rem; color: var(--admin-accent); margin-bottom: 1rem;">Tickets by Tier</h3>
      <div class="admin-tickets-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        ${tiers.map(tier => `
          <div class="admin-ticket-tier-card" style="background: var(--admin-card-bg); border: 1px solid var(--admin-border); border-left: 4px solid ${tierColors[tier]}; border-radius: 8px; padding: 1rem;">
            <div class="admin-ticket-tier-name" style="font-size: 0.9rem; color: var(--admin-text-secondary); margin-bottom: 0.5rem;">${tier}</div>
            <div class="admin-ticket-tier-count" style="font-size: 1.5rem; font-weight: 600; color: var(--admin-text);">${stats.ticketCounts?.[tier] || 0}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function loadWithdrawals() {
  try {
    // Load stats
    const statsRes = await fetch(`${API_BASE}/api/admin/withdrawals/stats`, {
      credentials: 'include',
    });
    const statsData = await statsRes.json();
    
    if (statsData.ok) {
      renderWithdrawalStats(statsData.stats);
    }

    // Load withdrawals
    const filter = currentWithdrawalFilter === 'all' ? '' : `?status=${currentWithdrawalFilter}`;
    const res = await fetch(`${API_BASE}/api/admin/withdrawals${filter}`, {
      credentials: 'include',
    });
    
    const data = await res.json();
    
    if (data.ok) {
      renderWithdrawals(data.withdrawals);
    } else {
      console.error('Failed to load withdrawals:', data.error);
    }
  } catch (error) {
    console.error('Error loading withdrawals:', error);
  }
}

/**
 * Render withdrawal statistics
 */
function renderWithdrawalStats(stats) {
  const container = document.getElementById('withdrawalsStats');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-stats-grid">
      <div class="admin-stat-card">
        <div class="admin-stat-label">Total Requests</div>
        <div class="admin-stat-value">${stats.total}</div>
      </div>
      <div class="admin-stat-card admin-stat-pending">
        <div class="admin-stat-label">Pending</div>
        <div class="admin-stat-value">${stats.pending}</div>
      </div>
      <div class="admin-stat-card admin-stat-paid">
        <div class="admin-stat-label">Paid</div>
        <div class="admin-stat-value">${stats.paid}</div>
      </div>
      <div class="admin-stat-card admin-stat-rejected">
        <div class="admin-stat-label">Rejected</div>
        <div class="admin-stat-value">${stats.rejected}</div>
      </div>
    </div>
  `;
}

/**
 * Render withdrawal requests list
 */
function renderWithdrawals(withdrawals) {
  const container = document.getElementById('withdrawalsList');
  if (!container) return;

  if (withdrawals.length === 0) {
    container.innerHTML = '<p class="admin-empty-state">No withdrawal requests found.</p>';
    return;
  }

  const tierMetadata = {
    EMERALD: { name: 'Emerald', color: '#50C878' },
    SAPPHIRE: { name: 'Sapphire', color: '#0F52BA' },
    RUBY: { name: 'Ruby', color: '#E0115F' },
    AMETHYST: { name: 'Amethyst', color: '#9966CC' },
    DIAMOND: { name: 'Diamond', color: '#B9F2FF' },
  };

  container.innerHTML = withdrawals.map(withdrawal => {
    const metadata = tierMetadata[withdrawal.tier] || { name: withdrawal.tier, color: '#FFFFFF' };
    const statusColors = {
      PENDING: '#FFAA00',
      PROCESSING: '#00AAFF',
      PAID: '#00FF00',
      REJECTED: '#FF0000',
      CANCELLED: '#888888',
    };

    const date = new Date(withdrawal.createdAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="admin-withdrawal-card" data-id="${withdrawal.id}">
        <div class="admin-withdrawal-header">
          <div class="admin-withdrawal-user">
            <strong>${withdrawal.user.publicName || withdrawal.user.name || 'Unknown'}</strong>
            <span class="admin-withdrawal-email">${withdrawal.user.email}</span>
          </div>
          <div class="admin-withdrawal-status" style="color: ${statusColors[withdrawal.status] || '#FFFFFF'}">
            ${withdrawal.status}
          </div>
        </div>
        <div class="admin-withdrawal-details">
          <div class="admin-withdrawal-detail">
            <span class="admin-detail-label">Tier:</span>
            <span class="admin-detail-value" style="color: ${metadata.color}">${metadata.name}</span>
          </div>
          <div class="admin-withdrawal-detail">
            <span class="admin-detail-label">Amount:</span>
            <span class="admin-detail-value">${withdrawal.amount} ticket${withdrawal.amount !== 1 ? 's' : ''}</span>
          </div>
          <div class="admin-withdrawal-detail">
            <span class="admin-detail-label">Requested:</span>
            <span class="admin-detail-value">${dateStr}</span>
          </div>
          ${withdrawal.btcAddress ? `
            <div class="admin-withdrawal-detail">
              <span class="admin-detail-label">Bitcoin Address:</span>
              <span class="admin-detail-value admin-address-value">${withdrawal.btcAddress}</span>
            </div>
          ` : ''}
          ${withdrawal.solAddress ? `
            <div class="admin-withdrawal-detail">
              <span class="admin-detail-label">Solana Address:</span>
              <span class="admin-detail-value admin-address-value">${withdrawal.solAddress}</span>
            </div>
          ` : ''}
          ${withdrawal.adminNotes ? `
            <div class="admin-withdrawal-detail">
              <span class="admin-detail-label">Admin Notes:</span>
              <span class="admin-detail-value">${withdrawal.adminNotes}</span>
            </div>
          ` : ''}
        </div>
        ${withdrawal.status === 'PENDING' || withdrawal.status === 'PROCESSING' ? `
          <div class="admin-withdrawal-actions">
            <button class="admin-btn admin-btn-success" onclick="markWithdrawalPaid('${withdrawal.id}')">
              Mark as Paid
            </button>
            <button class="admin-btn admin-btn-danger" onclick="markWithdrawalRejected('${withdrawal.id}')">
              Reject
            </button>
            <button class="admin-btn admin-btn-secondary" onclick="markWithdrawalProcessing('${withdrawal.id}')">
              Mark Processing
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Set up filter buttons
  document.querySelectorAll('.admin-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.admin-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentWithdrawalFilter = btn.dataset.filter;
      loadWithdrawals();
    });
  });
}

function setupLobbyFilterHandlers() {
  const tierSelect = document.getElementById('adminLobbyTierFilter');
  const statusSelect = document.getElementById('adminLobbyStatusFilter');
  const daysSelect = document.getElementById('adminLobbyDaysFilter');

  if (tierSelect) {
    tierSelect.value = currentLobbyFilters.tier;
    tierSelect.addEventListener('change', () => {
      currentLobbyFilters.tier = tierSelect.value;
      loadAdminLobbies();
    });
  }

  if (statusSelect) {
    statusSelect.value = currentLobbyFilters.status;
    statusSelect.addEventListener('change', () => {
      currentLobbyFilters.status = statusSelect.value;
      loadAdminLobbies();
    });
  }

  if (daysSelect) {
    daysSelect.value = currentLobbyFilters.days;
    daysSelect.addEventListener('change', () => {
      currentLobbyFilters.days = daysSelect.value;
      loadAdminLobbies();
    });
  }
}

async function loadAdminLobbies() {
  try {
    const params = new URLSearchParams();
    if (currentLobbyFilters.tier) params.append('tier', currentLobbyFilters.tier);
    if (currentLobbyFilters.status) params.append('status', currentLobbyFilters.status);
    if (currentLobbyFilters.days) params.append('days', currentLobbyFilters.days);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/api/admin/lobbies${query}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (data.ok) {
      renderAdminLobbies(data.lobbies || []);
      if (selectedLobbyId) {
        await loadLobbyDetail(selectedLobbyId);
      } else if (data.lobbies && data.lobbies.length > 0) {
        selectedLobbyId = data.lobbies[0].id;
        await loadLobbyDetail(selectedLobbyId);
      } else {
        selectedLobbyId = null;
        const detail = document.getElementById('adminLobbyDetail');
        if (detail) {
          detail.innerHTML = '<p>No lobbies found for the selected filters.</p>';
        }
      }
    } else {
      throw new Error(data.error || 'Failed to load lobbies');
    }
  } catch (error) {
    console.error('Error loading lobbies:', error);
    const list = document.getElementById('adminLobbyList');
    if (list) {
      list.innerHTML = `<div class="admin-empty-state">${error.message}</div>`;
    }
  }
}

function renderAdminLobbies(lobbies) {
  const list = document.getElementById('adminLobbyList');
  if (!list) return;

  if (!lobbies.length) {
    list.innerHTML = '<div class="admin-empty-state">No lobbies found.</div>';
    return;
  }

  list.innerHTML = lobbies.map(lobby => `
    <div class="admin-lobby-row ${selectedLobbyId === lobby.id ? 'active' : ''}" data-id="${lobby.id}">
      <div>
        <h4>${lobby.tier} Lobby</h4>
        <div class="admin-lobby-meta">${lobby.playerCount} / ${lobby.maxPlayers} players</div>
      </div>
      <div class="admin-lobby-status ${lobby.status.toLowerCase()}">${lobby.status}</div>
    </div>
  `).join('');

  list.querySelectorAll('.admin-lobby-row').forEach(row => {
    row.addEventListener('click', () => {
      selectedLobbyId = row.dataset.id;
      list.querySelectorAll('.admin-lobby-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      loadLobbyDetail(selectedLobbyId);
    });
  });
}

async function loadLobbyDetail(lobbyId) {
  const detail = document.getElementById('adminLobbyDetail');
  if (!detail) return;
  detail.innerHTML = '<p>Loading lobby details...</p>';
  try {
    const res = await fetch(`${API_BASE}/api/admin/lobbies/${lobbyId}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to fetch lobby');
    }
    renderLobbyDetail(data.lobby);
  } catch (error) {
    console.error('Error loading lobby detail:', error);
    detail.innerHTML = `<p>${error.message}</p>`;
  }
}

function renderLobbyDetail(lobby) {
  const detail = document.getElementById('adminLobbyDetail');
  if (!detail) return;
  if (!lobby) {
    detail.innerHTML = '<p>Lobby not found.</p>';
    return;
  }

  detail.innerHTML = `
    <h3>${lobby.tier} Lobby</h3>
    <div class="admin-detail-grid">
      <div class="admin-detail-card">
        <label>Status</label>
        <strong>${lobby.status}</strong>
      </div>
      <div class="admin-detail-card">
        <label>Players</label>
        <strong>${lobby.playerCount} / ${lobby.maxPlayers}</strong>
      </div>
      <div class="admin-detail-card">
        <label>Created</label>
        <strong>${formatAdminDate(lobby.createdAt)}</strong>
      </div>
      <div class="admin-detail-card">
        <label>Countdown</label>
        <strong>${formatAdminDate(lobby.countdownStartsAt)}</strong>
      </div>
      <div class="admin-detail-card">
        <label>Game Start</label>
        <strong>${formatAdminDate(lobby.countdownEndsAt)}</strong>
      </div>
      <div class="admin-detail-card">
        <label>Resolved</label>
        <strong>${formatAdminDate(lobby.resolvedAt)}</strong>
      </div>
    </div>
    ${lobby.round ? `
      <h4>Round Details</h4>
      <div class="admin-detail-grid">
        <div class="admin-detail-card">
          <label>Spin Force Base</label>
          <strong>${lobby.round.spinForceBase || lobby.baseSpinForce || '—'}</strong>
        </div>
        <div class="admin-detail-card">
          <label>Total Spin Force</label>
          <strong>${lobby.round.spinForceTotal || '—'}</strong>
        </div>
        <div class="admin-detail-card">
          <label>Spin Force Final</label>
          <strong>${lobby.round.spinForceFinal || '—'}</strong>
        </div>
        <div class="admin-detail-card">
          <label>Winning Segment</label>
          <strong>${lobby.round.winningSegment || '—'}</strong>
        </div>
        <div class="admin-detail-card">
          <label>Winning Number</label>
          <strong>${lobby.round.winningNumber || '—'}</strong>
        </div>
        <div class="admin-detail-card">
          <label>Seed</label>
          <strong title="${lobby.round.seed || ''}">${lobby.round.seed ? `${lobby.round.seed.slice(0, 12)}…` : '—'}</strong>
        </div>
      </div>
      ${lobby.round.spinStartedAt ? `
        <div class="admin-detail-grid">
          <div class="admin-detail-card">
            <label>Spin Started</label>
            <strong>${formatAdminDate(lobby.round.spinStartedAt)}</strong>
          </div>
          <div class="admin-detail-card">
            <label>Spin Completed</label>
            <strong>${formatAdminDate(lobby.round.spinCompletedAt)}</strong>
          </div>
          <div class="admin-detail-card">
            <label>Resolved</label>
            <strong>${formatAdminDate(lobby.round.resolvedAt)}</strong>
          </div>
        </div>
      ` : ''}
    ` : ''}
    <h4>Players (${lobby.players.length})</h4>
    ${lobby.players.length > 0 ? `
      <div class="admin-lobby-lucky-numbers">
        <strong>Lucky Numbers:</strong> ${lobby.players.map(p => p.luckyNumber).filter(n => n != null).join(', ')}
        <br><small>Total: ${lobby.players.reduce((sum, p) => sum + (p.luckyNumber || 0), 0)}</small>
      </div>
      <table class="admin-lobby-player-table">
        <thead>
          <tr>
            <th>Display name</th>
            <th>Email</th>
            <th>Lucky #</th>
            <th>Ticket Tier</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          ${lobby.players.map(player => `
            <tr ${player.luckyNumber === lobby.round?.winningNumber ? 'class="admin-winner-row"' : ''}>
              <td>${player.displayName || 'Anonymous'}</td>
              <td>${player.email || '—'}</td>
              <td><strong>${player.luckyNumber ?? '—'}</strong></td>
              <td>${player.ticketTierUsed || '—'}</td>
              <td>${formatAdminDate(player.joinedAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>No players in this lobby.</p>'}
  `;
}

function formatAdminDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

/**
 * Mark withdrawal as paid
 */
async function markWithdrawalPaid(id) {
  if (!confirm('Mark this withdrawal request as PAID? This action cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/withdrawals/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'PAID' }),
    });

    const data = await res.json();
    if (data.ok) {
      await loadWithdrawals();
    } else {
      alert('Failed to update withdrawal: ' + data.error);
    }
  } catch (error) {
    console.error('Error marking withdrawal as paid:', error);
    alert('Error updating withdrawal request');
  }
}

/**
 * Mark withdrawal as rejected
 */
async function markWithdrawalRejected(id) {
  const notes = prompt('Enter rejection reason (optional):');
  if (notes === null) return; // User cancelled

  try {
    const res = await fetch(`${API_BASE}/api/admin/withdrawals/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        status: 'REJECTED',
        adminNotes: notes || undefined,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      await loadWithdrawals();
    } else {
      alert('Failed to update withdrawal: ' + data.error);
    }
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    alert('Error updating withdrawal request');
  }
}

/**
 * Mark withdrawal as processing
 */
async function markWithdrawalProcessing(id) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/withdrawals/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'PROCESSING' }),
    });

    const data = await res.json();
    if (data.ok) {
      await loadWithdrawals();
    } else {
      alert('Failed to update withdrawal: ' + data.error);
    }
  } catch (error) {
    console.error('Error marking withdrawal as processing:', error);
    alert('Error updating withdrawal request');
  }
}

// Make functions globally available for onclick handlers
window.markWithdrawalPaid = markWithdrawalPaid;
window.markWithdrawalRejected = markWithdrawalRejected;
window.markWithdrawalProcessing = markWithdrawalProcessing;

/**
 * Set up sign out functionality for the email element
 */
function setupSignOutHandler(emailEl) {
  const modal = document.getElementById('signout-modal');
  const confirmBtn = document.getElementById('signout-confirm');
  const cancelBtn = document.getElementById('signout-cancel');
  
  if (!emailEl || !modal || !confirmBtn || !cancelBtn) {
    console.warn('Sign out elements not found');
    return;
  }
  
  // Remove any existing click handlers to avoid duplicates
  const newEmailEl = emailEl.cloneNode(true);
  emailEl.parentNode.replaceChild(newEmailEl, emailEl);
  
  // Make email clickable
  newEmailEl.style.cursor = 'pointer';
  newEmailEl.style.userSelect = 'none';
  newEmailEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    modal.style.display = 'flex';
  });
  
  // Cancel button
  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // Confirm button
  confirmBtn.addEventListener('click', async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.ok) {
        // Redirect to home page
        window.location.href = '/';
      } else {
        console.error('Logout failed:', data.error);
        alert('Failed to sign out. Please try again.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error signing out. Please try again.');
    }
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
    }
  });
}

/**
 * Load admin game history list
 */
let adminGameHistorySelected = null;
let adminGameHistorySearchTerm = '';

// App state
const appState = {
  adminGameHistory: [],
  adminGameHistoryFiltered: [],
};

async function loadAdminGameHistory() {
  const listEl = document.getElementById('adminGameHistoryList');
  if (!listEl) return;

  try {
    listEl.innerHTML = '<p>Loading game history...</p>';
    const res = await fetch(`${API_BASE}/api/admin/game-history?limit=100`, {
      credentials: 'include',
    });
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || 'Failed to load game history');
    }

    appState.adminGameHistory = data.histories || [];
    appState.adminGameHistoryFiltered = data.histories || [];
    renderAdminGameHistoryList();
  } catch (error) {
    console.error('Error loading game history:', error);
    listEl.innerHTML = `<p style="color: var(--admin-danger);">Error: ${error.message}</p>`;
  }
}

function filterAdminGameHistory() {
  const searchTerm = adminGameHistorySearchTerm.trim();
  
  if (!searchTerm) {
    appState.adminGameHistoryFiltered = appState.adminGameHistory || [];
    return;
  }

  // Normalize search term - remove leading zeros and convert to number for comparison
  const searchNum = searchTerm.replace(/^0+/, '') || '0';
  
  appState.adminGameHistoryFiltered = (appState.adminGameHistory || []).filter((history) => {
    // Check if game number contains the search term (as string)
    const gameNumStr = history.gameNumber.toString();
    const gameNumNormalized = gameNumStr.replace(/^0+/, '') || '0';
    
    // Match by normalized number or by string contains
    return gameNumStr.includes(searchTerm) || 
           gameNumNormalized.includes(searchNum) ||
           gameNumStr.padStart(9, '0').includes(searchTerm.padStart(9, '0'));
  });
}

function renderAdminGameHistoryList() {
  const listEl = document.getElementById('adminGameHistoryList');
  if (!listEl) return;

  filterAdminGameHistory();
  const histories = appState.adminGameHistoryFiltered || [];

  if (histories.length === 0) {
    if (adminGameHistorySearchTerm.trim()) {
      listEl.innerHTML = `<p>No games found matching "${adminGameHistorySearchTerm}".</p>`;
    } else {
      listEl.innerHTML = '<p>No games recorded yet.</p>';
    }
    return;
  }

  listEl.innerHTML = histories
    .map((history) => {
      const isSelected = adminGameHistorySelected === history.gameNumber;
      const dateStr = history.resolvedAt
        ? new Date(history.resolvedAt).toLocaleString()
        : 'Pending';
      return `
        <div class="admin-game-history-card ${isSelected ? 'active' : ''}" data-game="${history.gameNumber}">
          <div class="admin-game-history-card-header">
            <strong>Game #${formatGameNumber(history.gameNumber)}</strong>
            <span class="admin-badge admin-badge-${history.tier.toLowerCase()}">${history.tier}</span>
          </div>
          <div class="admin-game-history-card-meta">
            <div>${dateStr}</div>
            <div>Players: ${history.playerCount} • Winner: ${history.winningNumber ?? '??'}</div>
          </div>
        </div>
      `;
    })
    .join('');

  // Add click handlers
  listEl.querySelectorAll('.admin-game-history-card').forEach((card) => {
    card.addEventListener('click', () => {
      const gameNumber = card.dataset.game;
      selectAdminGameHistory(gameNumber);
    });
  });
}

async function selectAdminGameHistory(gameNumber) {
  adminGameHistorySelected = gameNumber;
  renderAdminGameHistoryList();

  const detailEl = document.getElementById('adminGameHistoryDetail');
  if (!detailEl) return;

  try {
    detailEl.innerHTML = '<p>Loading game details...</p>';
    const res = await fetch(`${API_BASE}/api/admin/game-history/${gameNumber}`, {
      credentials: 'include',
    });
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || 'Failed to load game details');
    }

    renderAdminGameHistoryDetail(data.history);
  } catch (error) {
    console.error('Error loading game detail:', error);
    detailEl.innerHTML = `<p style="color: var(--admin-danger);">Error: ${error.message}</p>`;
  }
}

function renderAdminGameHistoryDetail(history) {
  const detailEl = document.getElementById('adminGameHistoryDetail');
  if (!detailEl) return;

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  detailEl.innerHTML = `
    <div class="admin-game-history-detail-header">
      <h3>Game #${formatGameNumber(history.gameNumber)}</h3>
      <p>Lobby: ${history.lobbyId || 'N/A'} • Seed: ${history.seed ? history.seed.slice(0, 16) + '…' : '—'}</p>
    </div>
    <div class="admin-game-history-detail-grid">
      <div class="admin-info-card">
        <label>Tier</label>
        <strong>${history.tier}</strong>
      </div>
      <div class="admin-info-card">
        <label>Status</label>
        <strong>${history.status}</strong>
      </div>
      <div class="admin-info-card">
        <label>Spin Base</label>
        <strong>${history.spinForceBase}</strong>
      </div>
      <div class="admin-info-card">
        <label>Spin Total</label>
        <strong>${history.spinForceTotal}</strong>
      </div>
      <div class="admin-info-card">
        <label>Spin Final</label>
        <strong>${history.spinForceFinal}</strong>
      </div>
      <div class="admin-info-card">
        <label>Winning Number</label>
        <strong>${history.winningNumber ?? '??'}</strong>
      </div>
      <div class="admin-info-card">
        <label>Countdown Start</label>
        <strong>${formatDateTime(history.countdownStartedAt)}</strong>
      </div>
      <div class="admin-info-card">
        <label>Spin Start</label>
        <strong>${formatDateTime(history.gameStartedAt)}</strong>
      </div>
      <div class="admin-info-card">
        <label>Resolved</label>
        <strong>${formatDateTime(history.resolvedAt)}</strong>
      </div>
    </div>
    <div class="admin-game-history-players">
      <h4>Players (${history.players?.length || 0})</h4>
      <div class="admin-game-history-players-list">
        ${(history.players || [])
          .map(
            (player) => `
              <div class="admin-game-history-player-row ${player.isWinner ? 'winner' : ''}">
                <div class="admin-game-history-player-info">
                  <div class="admin-game-history-player-name">${escapeHtml(player.displayName || 'Anonymous')}</div>
                  <div class="admin-game-history-player-email">${player.email || 'Hidden'}</div>
                  <div class="admin-game-history-player-time">${formatDateTime(player.joinedAt)}</div>
                </div>
                <div class="admin-game-history-player-number">
                  ${player.luckyNumber ?? '?'}
                  ${player.isWinner ? '<span class="admin-winner-badge">Winner</span>' : ''}
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    </div>
  `;
}

function formatGameNumber(num) {
  if (!num) return '000000000';
  const str = num.toString();
  return str.padStart(9, '0');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Set up game history search
function setupGameHistorySearch() {
  const searchInput = document.getElementById('adminGameHistorySearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    adminGameHistorySearchTerm = e.target.value;
    renderAdminGameHistoryList();
  });

  // Clear selection when searching
  searchInput.addEventListener('input', () => {
    if (adminGameHistorySearchTerm.trim()) {
      adminGameHistorySelected = null;
      const detailEl = document.getElementById('adminGameHistoryDetail');
      if (detailEl) {
        detailEl.innerHTML = '<p>Select a game from the filtered list to view full details.</p>';
      }
    }
  });
}

// Users management
let adminUsers = [];
let adminUsersSearchTerm = '';
let adminUsersExpanded = new Set();

async function loadAdminUsers() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/users`, {
      credentials: 'include',
    });
    
    const data = await response.json();
    
    if (data.ok) {
      adminUsers = data.users;
      renderAdminUsers();
      setupUsersSearch();
    } else {
      document.getElementById('adminUsersList').innerHTML = 
        `<div class="admin-error">Failed to load users: ${data.error || 'Unknown error'}</div>`;
    }
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('adminUsersList').innerHTML = 
      '<div class="admin-error">Error loading users. Please refresh the page.</div>';
  }
}

function setupUsersSearch() {
  const searchInput = document.getElementById('admin-users-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      adminUsersSearchTerm = e.target.value.toLowerCase();
      renderAdminUsers();
    });
  }
}

function renderAdminUsers() {
  const container = document.getElementById('adminUsersList');
  if (!container) return;

  const filtered = adminUsers.filter(user => {
    if (!adminUsersSearchTerm) return true;
    const search = adminUsersSearchTerm;
    return (
      (user.publicName || '').toLowerCase().includes(search) ||
      (user.email || '').toLowerCase().includes(search) ||
      (user.name || '').toLowerCase().includes(search)
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="admin-empty">No users found.</div>';
    return;
  }

  container.innerHTML = filtered.map(user => {
    const isExpanded = adminUsersExpanded.has(user.id);
    const wallet = user.ticketWallet || {};
    const tiers = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'DIAMOND'];
    const walletDisplay = tiers.map(tier => `${tier}: ${wallet[tier] || 0}`).join(', ');
    
    const playtime = user.stats.firstGameAt && user.stats.lastGameAt
      ? Math.round((new Date(user.stats.lastGameAt) - new Date(user.stats.firstGameAt)) / (1000 * 60 * 60 * 24))
      : null;

    return `
      <div class="admin-user-card">
        <div class="admin-user-header" onclick="toggleUserDetail('${user.id}')">
          <div class="admin-user-header-left">
            <div class="admin-user-number">#${user.playerNumber}</div>
            <div class="admin-user-info">
              <div class="admin-user-name">${escapeHtml(user.publicName)}</div>
              <div class="admin-user-email">${escapeHtml(user.email)}</div>
            </div>
          </div>
          <div class="admin-user-header-right">
            <div class="admin-user-stats-inline">
              <span>${user.stats.gamesPlayed} games</span>
              <span>${user.stats.gamesWon} wins</span>
              ${user.stats.latestIpAddress ? `<span title="Latest IP">📍 ${user.stats.latestIpAddress}</span>` : ''}
              ${user.role === 'ADMIN' ? '<span class="admin-badge">Admin</span>' : ''}
            </div>
            <div class="admin-expand-icon">${isExpanded ? '▼' : '▶'}</div>
          </div>
        </div>
        ${isExpanded ? `
          <div class="admin-user-detail" id="user-detail-${user.id}">
            <div class="admin-user-detail-loading">Loading details...</div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Load details for expanded users
  adminUsersExpanded.forEach(userId => {
    loadUserDetail(userId);
  });
}

async function toggleUserDetail(userId) {
  if (adminUsersExpanded.has(userId)) {
    adminUsersExpanded.delete(userId);
  } else {
    adminUsersExpanded.add(userId);
  }
  renderAdminUsers();
}

async function loadUserDetail(userId) {
  try {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
      credentials: 'include',
    });
    
    const data = await response.json();
    
    if (data.ok) {
      renderUserDetail(data.user);
    } else {
      const detailEl = document.getElementById(`user-detail-${userId}`);
      if (detailEl) {
        detailEl.innerHTML = `<div class="admin-error">Failed to load details: ${data.error || 'Unknown error'}</div>`;
      }
    }
  } catch (error) {
    console.error('Error loading user detail:', error);
    const detailEl = document.getElementById(`user-detail-${userId}`);
    if (detailEl) {
      detailEl.innerHTML = '<div class="admin-error">Error loading user details.</div>';
    }
  }
}

function renderUserDetail(user) {
  const detailEl = document.getElementById(`user-detail-${user.id}`);
  if (!detailEl) return;

  const wallet = user.ticketWallet || {};
  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'DIAMOND'];
  
  const playtime = user.stats.firstGameAt && user.stats.lastGameAt
    ? Math.round((new Date(user.stats.lastGameAt) - new Date(user.stats.firstGameAt)) / (1000 * 60 * 60 * 24))
    : null;

  detailEl.innerHTML = `
    <div class="admin-user-detail-content">
      <div class="admin-user-detail-section">
        <h3>Google Account Details</h3>
        <div class="admin-user-detail-grid">
          <div class="admin-user-detail-item">
            <label>Email:</label>
            <span>${escapeHtml(user.email)}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Name:</label>
            <span>${escapeHtml(user.name || 'N/A')}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Public Name:</label>
            <span>${escapeHtml(user.publicName || 'N/A')}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Google Sub:</label>
            <span>${escapeHtml(user.googleSub)}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Picture URL:</label>
            <span>${user.picture ? `<a href="${escapeHtml(user.picture)}" target="_blank">View</a>` : 'N/A'}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Avatar URL:</label>
            <span>${user.avatarUrl ? `<a href="${escapeHtml(user.avatarUrl)}" target="_blank">View</a>` : 'N/A'}</span>
          </div>
        </div>
      </div>

      <div class="admin-user-detail-section">
        <h3>Account Information</h3>
        <div class="admin-user-detail-grid">
          <div class="admin-user-detail-item">
            <label>User ID:</label>
            <span>${escapeHtml(user.id)}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Role:</label>
            <span>${user.role}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Created At:</label>
            <span>${formatAdminDate(user.createdAt)}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Last Updated:</label>
            <span>${formatAdminDate(user.updatedAt)}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Credits (Legacy):</label>
            <span>${user.credits || 0}</span>
          </div>
        </div>
      </div>

      <div class="admin-user-detail-section">
        <h3>Ticket Wallet</h3>
        <div class="admin-user-detail-grid">
          ${tiers.map(tier => `
            <div class="admin-user-detail-item">
              <label>${tier}:</label>
              <span id="wallet-${tier}-${user.id}">${wallet[tier] || 0}</span>
            </div>
          `).join('')}
        </div>
        <div class="admin-add-tickets-form" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--admin-border);">
          <h4 style="margin-bottom: 1rem; color: var(--admin-accent);">Add Tickets</h4>
          <div style="display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 150px;">
              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--admin-text-secondary);">Tier</label>
              <select id="add-tickets-tier-${user.id}" class="admin-select" style="width: 100%; padding: 0.5rem; background: var(--admin-surface); border: 1px solid var(--admin-border); color: var(--admin-text); border-radius: 4px;">
                ${tiers.map(tier => `<option value="${tier}">${tier}</option>`).join('')}
              </select>
            </div>
            <div style="flex: 1; min-width: 150px;">
              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--admin-text-secondary);">Amount</label>
              <input type="number" id="add-tickets-amount-${user.id}" class="admin-input" min="1" value="1" style="width: 100%; padding: 0.5rem; background: var(--admin-surface); border: 1px solid var(--admin-border); color: var(--admin-text); border-radius: 4px;">
            </div>
            <div style="flex: 1; min-width: 200px;">
              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--admin-text-secondary);">Reason (optional)</label>
              <input type="text" id="add-tickets-reason-${user.id}" class="admin-input" placeholder="e.g., Admin adjustment" style="width: 100%; padding: 0.5rem; background: var(--admin-surface); border: 1px solid var(--admin-border); color: var(--admin-text); border-radius: 4px;">
            </div>
            <div>
              <button onclick="addTicketsToUser('${user.id}')" class="admin-btn admin-btn-primary" style="padding: 0.5rem 1.5rem; white-space: nowrap;">
                Add Tickets
              </button>
            </div>
          </div>
          <div id="add-tickets-message-${user.id}" style="margin-top: 0.75rem; min-height: 1.5rem;"></div>
        </div>
      </div>

      <div class="admin-user-detail-section">
        <h3>Statistics</h3>
        <div class="admin-user-detail-grid">
          <div class="admin-user-detail-item">
            <label>Games Played:</label>
            <span>${user.stats.gamesPlayed}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Games Won:</label>
            <span>${user.stats.gamesWon}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Win Rate:</label>
            <span>${user.stats.gamesPlayed > 0 ? ((user.stats.gamesWon / user.stats.gamesPlayed) * 100).toFixed(1) : 0}%</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Lobbies Joined:</label>
            <span>${user.stats.lobbiesJoined}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Transactions:</label>
            <span>${user.stats.transactions}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Free Attempts:</label>
            <span>${user.stats.freeAttempts}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>First Game:</label>
            <span>${user.stats.firstGameAt ? formatAdminDate(user.stats.firstGameAt) : 'Never'}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Last Game:</label>
            <span>${user.stats.lastGameAt ? formatAdminDate(user.stats.lastGameAt) : 'Never'}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>First Game #:</label>
            <span>${user.stats.firstGameNumber ? formatGameNumber(user.stats.firstGameNumber) : 'N/A'}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Last Game #:</label>
            <span>${user.stats.lastGameNumber ? formatGameNumber(user.stats.lastGameNumber) : 'N/A'}</span>
          </div>
          ${playtime !== null ? `
            <div class="admin-user-detail-item">
              <label>Playtime (Days):</label>
              <span>${playtime} days</span>
            </div>
          ` : ''}
          <div class="admin-user-detail-item">
            <label>Latest IP Address:</label>
            <span>${user.stats.latestIpAddress || 'N/A'}</span>
          </div>
          <div class="admin-user-detail-item">
            <label>Unique IP Count:</label>
            <span>${user.stats.uniqueIpCount || 0}</span>
          </div>
        </div>
      </div>

      ${user.ipHistory && user.ipHistory.length > 0 ? `
        <div class="admin-user-detail-section">
          <h3>IP Address History</h3>
          <div class="admin-user-ip-history">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>User Agent</th>
                  <th>First Seen</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                ${user.ipHistory.map(ip => `
                  <tr>
                    <td><code>${escapeHtml(ip.ipAddress)}</code></td>
                    <td>${escapeHtml(ip.userAgent || 'N/A')}</td>
                    <td>${formatAdminDate(ip.createdAt)}</td>
                    <td>${formatAdminDate(ip.lastSeenAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${user.gameHistory && user.gameHistory.length > 0 ? `
        <div class="admin-user-detail-section">
          <h3>Game History (Last ${user.gameHistory.length} games)</h3>
          <div class="admin-user-game-history">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Game #</th>
                  <th>Tier</th>
                  <th>Lucky #</th>
                  <th>Winning #</th>
                  <th>Result</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${user.gameHistory.map(game => `
                  <tr>
                    <td>${formatGameNumber(game.gameNumber)}</td>
                    <td>${game.tier}</td>
                    <td>${game.luckyNumber || 'N/A'}</td>
                    <td>${game.winningNumber || 'N/A'}</td>
                    <td>${game.isWinner ? '<span class="admin-badge admin-badge-success">Winner</span>' : 'Lost'}</td>
                    <td>${formatAdminDate(game.resolvedAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Make toggleUserDetail available globally
window.toggleUserDetail = toggleUserDetail;

// Add tickets to user
async function addTicketsToUser(userId) {
  const tierSelect = document.getElementById(`add-tickets-tier-${userId}`);
  const amountInput = document.getElementById(`add-tickets-amount-${userId}`);
  const reasonInput = document.getElementById(`add-tickets-reason-${userId}`);
  const messageEl = document.getElementById(`add-tickets-message-${userId}`);
  
  const tier = tierSelect.value;
  const amount = parseInt(amountInput.value);
  const reason = reasonInput.value.trim();
  
  // Validate
  if (!tier || !amount || amount < 1) {
    messageEl.innerHTML = '<span style="color: var(--admin-danger);">Please enter a valid amount (1 or more)</span>';
    return;
  }
  
  // Disable button and show loading
  const formContainer = tierSelect.closest('.admin-add-tickets-form');
  const btn = formContainer?.querySelector('button');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Adding...';
  }
  messageEl.innerHTML = '<span style="color: var(--admin-text-secondary);">Adding tickets...</span>';
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/add-tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        tier,
        amount,
        reason: reason || undefined,
      }),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      messageEl.innerHTML = `<span style="color: var(--admin-success);">✅ ${data.message}</span>`;
      
      // Update wallet display
      const walletTierEl = document.getElementById(`wallet-${tier}-${userId}`);
      if (walletTierEl && data.wallet) {
        walletTierEl.textContent = data.wallet[tier] || 0;
      }
      
      // Update all wallet values
      const allTiers = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'DIAMOND'];
      allTiers.forEach(t => {
        const el = document.getElementById(`wallet-${t}-${userId}`);
        if (el && data.wallet) {
          el.textContent = data.wallet[t] || 0;
        }
      });
      
      // Clear form
      amountInput.value = 1;
      reasonInput.value = '';
      
      // Reload full user data to refresh everything
      setTimeout(() => {
        loadUserDetail(userId);
      }, 1000);
    } else {
      messageEl.innerHTML = `<span style="color: var(--admin-danger);">❌ Error: ${data.error || 'Failed to add tickets'}</span>`;
    }
  } catch (error) {
    console.error('Error adding tickets:', error);
    messageEl.innerHTML = `<span style="color: var(--admin-danger);">❌ Error: ${error.message || 'Failed to add tickets'}</span>`;
  } finally {
    // Re-enable button
    const formContainer = tierSelect.closest('.admin-add-tickets-form');
    const btn = formContainer?.querySelector('button');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Add Tickets';
    }
  }
}

// Make addTicketsToUser available globally
window.addTicketsToUser = addTicketsToUser;

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupGameHistorySearch();
  });
} else {
  init();
  setupGameHistorySearch();
}
