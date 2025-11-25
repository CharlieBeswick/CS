/**
 * Crypto Tickets Admin Panel
 * Clean admin dashboard skeleton
 */

const API_BASE = window.location.origin;

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
}

/**
 * Check if user has admin access
 */
async function checkAdminAccess() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    
    const data = await response.json();
    
    if (!data.ok || !data.user) {
      showNoAdminAccess('Not authenticated. Please sign in first.');
      return false;
    }
    
    // Update user email display
    const emailEl = document.getElementById('admin-user-email');
    if (emailEl) {
      emailEl.textContent = data.user.email;
    }
    
    // Try to load admin endpoint to verify admin access
    const adminResponse = await fetch(`${API_BASE}/api/admin/summary`, {
      credentials: 'include',
    });
    
    if (!adminResponse.ok) {
      if (adminResponse.status === 403) {
        showNoAdminAccess(`You are signed in as ${data.user.email}, but do not have admin rights for Crypto Tickets.`);
      } else {
        showNoAdminAccess('Failed to verify admin access.');
      }
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Admin access check error:', error);
    showNoAdminAccess('Error checking admin access.');
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
    if (messageEl) messageEl.textContent = message;
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
      // TODO: Load dashboard data
      break;
    case 'users':
      // TODO: Load users data
      break;
    case 'game-history':
      // TODO: Load game history data
      break;
    case 'current-lobbies':
      // TODO: Load current lobbies data
      break;
    case 'tier-pyramid':
      // TODO: Load tier pyramid data
      break;
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
