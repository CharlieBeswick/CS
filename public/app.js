/**
 * Crypto Snow - Frontend Application
 * Handles authentication, UI state, and game rendering
 */

// Application state
const appState = {
  currentUser: null,
  tombolas: [],
  currentScreen: 'login',
  countdownIntervals: new Map(),
  activeTombolaId: null, // Track which tombola modal is open
  activeTombolaTickets: [], // List of tickets for game animation
  gameCountdownTimer: null,
  gameSpinTimer: null,
  gameIsRunning: false,
  wallet: null, // 8-tier ticket wallet { BRONZE: 0, SILVER: 0, ... }
  freeAttemptsStatus: null, // { remainingAttempts: 3, usedToday: 0, maxPerDay: 3 }
  currentTierLobby: null, // Current tier lobby being viewed
  currentTier: null, // Current tier (BRONZE, SILVER, etc.)
  tierLobbyInterval: null,
  tierLobbyChatInterval: null,
  tierLobbyTimerInterval: null,
  tierLobbyChat: [],
  tierSelectedNumber: null,
  // Legacy Bronze support (for backward compatibility)
  bronzeLobby: null,
  bronzeLobbyInterval: null,
  bronzeLobbyChatInterval: null,
  bronzeLobbyTimerInterval: null,
  bronzeLobbyChat: [],
  bronzeSelectedNumber: null,
  gameHistory: [],
  gameHistorySelected: null,
  gameHistoryDetail: null,
  // Wheel physics state
  wheelState: {
    isSpinning: false,
    currentRotation: 0, // degrees
    currentSpeed: 0, // degrees per second
    spinInterval: null,
    lastUpdateTime: null,
  },
};

// Screen references
const screens = {
  login: document.getElementById('loginScreen'),
  lobby: document.getElementById('lobbyScreen'),
  bronzeLobby: document.getElementById('bronzeLobbyScreen'),
  profile: document.getElementById('profileScreen'),
  tickets: document.getElementById('ticketsScreen'),
  prizes: document.getElementById('prizesScreen'),
  redemption: document.getElementById('redemptionScreen'),
  history: document.getElementById('historyScreen'),
};

// API base URL
// Use Railway backend URL in production, or localhost for development
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://perpetual-reprieve-try3.up.railway.app';

/**
 * Initialize the application
 */
async function init() {
  // Set up event listeners first
  setupEventListeners();
  
  // Set up the big sign-in button - it will click Google's rendered button
  // Email/password form handlers
  const emailLoginForm = document.getElementById('emailLoginForm');
  if (emailLoginForm) {
    emailLoginForm.addEventListener('submit', handleEmailLogin);
  }

  const emailRegisterForm = document.getElementById('emailRegisterForm');
  if (emailRegisterForm) {
    emailRegisterForm.addEventListener('submit', handleEmailRegister);
  }

  // Toggle between login and register forms
  const showRegisterLink = document.getElementById('showRegisterLink');
  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      showRegisterForm();
    });
  }

  const showLoginLink = document.getElementById('showLoginLink');
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      showLoginForm();
    });
  }

  const bigSignInBtn = document.getElementById('bigSignInBtn');
  if (bigSignInBtn) {
    bigSignInBtn.addEventListener('click', () => {
      // Find Google's rendered button and click it
      const buttonContainer = document.getElementById('googleSignInButton');
      if (buttonContainer) {
        // Look for Google's rendered button element
        const googleBtn = buttonContainer.querySelector('div[role="button"]');
        if (googleBtn) {
          // Click Google's button
          googleBtn.click();
        } else {
          // Google button not rendered yet, try to trigger One Tap
          if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.prompt();
          } else {
            alert('Google Sign-In is still loading. Please wait a moment and try again.');
          }
        }
      }
    });
  }
  
  // Initialize Google Sign-In button in background (for One Tap)
  setTimeout(() => initializeGoogleSignIn(), 100);
  
  // Check if user is already authenticated
  await checkAuth();
}

/**
 * Check authentication status
 */
async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    const data = await response.json();
    
    if (data.ok && data.user) {
      setCurrentUser(data.user);
      // loadTombolas(); // Disabled - lobby redesigned
    } else {
      showScreen('login');
    }
  } catch (error) {
    console.error('Auth check error:', error);
    showScreen('login');
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Bottom navigation
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.bottom-nav .nav-item')
        .forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const target = item.getAttribute('data-screen');
      if (target === 'profile-screen') {
        showScreen('profile');
        populateProfileForm();
      } else if (target === 'lobby-screen') {
        showScreen('lobby');
      } else if (target === 'tickets-screen') {
        showScreen('tickets');
        loadTicketsScreen();
      } else if (target === 'prizes-screen') {
        showScreen('prizes');
        renderPrizesBreakdown(); // This is now async but we don't need to await it
      } else if (target === 'history-screen') {
        showScreen('history');
        loadHistoryScreen();
      }
    });
  });
  
  // Info modal
  const infoLink = document.getElementById('infoLink');
  const infoModal = document.getElementById('infoModal');
  const modalClose = document.getElementById('modalClose');
  
  if (infoLink) {
    infoLink.addEventListener('click', () => {
      infoModal.style.display = 'flex';
    });
  }
  
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      infoModal.style.display = 'none';
    });
  }
  
  // Close modal on background click
  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) {
        infoModal.style.display = 'none';
      }
    });
  }
  
  // Tombola modal
  const tombolaModal = document.getElementById('tombolaModal');
  const tombolaModalClose = document.getElementById('tombolaModalClose');
  
  if (tombolaModalClose) {
    tombolaModalClose.addEventListener('click', () => {
      tombolaModal.style.display = 'none';
    });
  }
  
  if (tombolaModal) {
    tombolaModal.addEventListener('click', (e) => {
      if (e.target === tombolaModal) {
        tombolaModal.style.display = 'none';
      }
    });
  }

  // Profile form submission
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const publicName = document.getElementById('profile-public-name').value.trim();
      const avatarUrl = document.getElementById('profile-avatar-url').value.trim() || null;

      if (!publicName) {
        alert('Please choose a public name.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ publicName, avatarUrl }),
        });

        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.error || 'Failed to save profile');
        }

        appState.currentUser = data.user;
        populateProfileForm();
        setUser(data.user);
        updateTicketsBalanceUI(); // Sync balance
        alert('Profile saved.');
        
        // Optionally bounce them back to lobby
        showScreen('lobby');
        document
          .querySelectorAll('.bottom-nav .nav-item')
          .forEach(i => i.classList.remove('active'));
        document
          .querySelector('.bottom-nav .nav-item[data-screen="lobby-screen"]')
          ?.classList.add('active');
      } catch (err) {
        console.error(err);
        alert('Something went wrong saving your profile.');
      }
    });
  }

  // Get Bronze Tickets button - navigates to My Tickets screen
  const getBronzeBtn = document.getElementById('getBronzeBtn');
  if (getBronzeBtn) {
    getBronzeBtn.addEventListener('click', () => {
      if (!appState.currentUser) {
        showScreen('login');
        return;
      }
      // Navigate to My Tickets screen (which now contains promotions features)
      showScreen('tickets');
      // Load free attempts status when opening My Tickets
      loadFreeAttemptsStatus();
      // Update bottom nav
      document.querySelectorAll('.bottom-nav .nav-item')
        .forEach(i => i.classList.remove('active'));
      document.querySelector('.bottom-nav .nav-item[data-screen="tickets-screen"]')
        ?.classList.add('active');
    });
  }

  // Watch ad button is now in My Tickets screen (handled below)

  // Free attempt button
  const freeAttemptBtn = document.getElementById('freeAttemptBtn');
  if (freeAttemptBtn) {
    freeAttemptBtn.addEventListener('click', handleFreeAttemptPlay);
  }

  // Redemption screen buttons
  const redemptionBackBtn = document.getElementById('redemptionBackBtn');
  if (redemptionBackBtn) {
    redemptionBackBtn.addEventListener('click', () => {
      showScreen('prizes');
      const bottomNav = document.querySelector('.bottom-nav');
      if (bottomNav) bottomNav.style.display = 'flex';
    });
  }

  const redemptionSubmitBtn = document.getElementById('redemptionSubmitBtn');
  if (redemptionSubmitBtn) {
    redemptionSubmitBtn.addEventListener('click', handleRedemptionSubmit);
  }

  // DEPRECATED: Legacy watch ad button (kept for backward compatibility)
  // TODO: Remove after confirming Promotions screen works
  const watchAdBtn = document.getElementById('watchAdBtn');
  if (watchAdBtn) {
    watchAdBtn.addEventListener('click', handleWatchAd);
  }

  // Sign out button
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', handleSignOut);
  }

  // Modal tab switching
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchModalTab(tab.dataset.tab);
    });
  });

  // Enter draw button
  const enterDrawBtn = document.getElementById('board-enter-btn');
  if (enterDrawBtn) {
    enterDrawBtn.addEventListener('click', handleEnterDraw);
  }

  // Game start button
  const gameStartBtn = document.getElementById('game-start-btn');
  if (gameStartBtn) {
    gameStartBtn.addEventListener('click', handleStartDraw);
  }

  const bronzeNumberButtons = document.getElementById('bronzeNumberButtons');
  if (bronzeNumberButtons) {
    bronzeNumberButtons.addEventListener('click', handleBronzeNumberClick);
  }

  const bronzeJoinBtn = document.getElementById('bronzeJoinButton');
  if (bronzeJoinBtn) {
    bronzeJoinBtn.addEventListener('click', handleBronzeJoin);
  }

  const bronzeChatForm = document.getElementById('bronzeChatForm');
  if (bronzeChatForm) {
    bronzeChatForm.addEventListener('submit', handleBronzeChatSubmit);
  }

  const bronzeLobbyBackBtn = document.getElementById('bronzeLobbyBackBtn');
  if (bronzeLobbyBackBtn) {
    bronzeLobbyBackBtn.addEventListener('click', () => {
      showScreen('lobby');
    });
  }

  const historyList = document.getElementById('historyList');
  if (historyList) {
    historyList.addEventListener('click', (event) => {
      const card = event.target.closest('.history-card');
      if (!card) return;
      const gameNumber = card.dataset.game;
      if (!gameNumber) return;
      selectHistoryGame(gameNumber);
    });
  }

  // History collapsible sections toggle (delegated event listener)
  document.addEventListener('click', (e) => {
    // Players toggle
    const playersToggle = e.target.closest('.history-players-toggle');
    if (playersToggle) {
      const gameNumber = playersToggle.dataset.game;
      const playersDiv = document.getElementById(`history-players-${gameNumber}`);
      if (playersDiv) {
        const isExpanded = playersDiv.style.display !== 'none';
        playersDiv.style.display = isExpanded ? 'none' : 'block';
        playersToggle.classList.toggle('expanded', !isExpanded);
      }
      return;
    }

    // Spin Stats toggle
    const spinStatsToggle = e.target.closest('.history-spin-stats-toggle');
    if (spinStatsToggle) {
      const gameNumber = spinStatsToggle.dataset.game;
      const spinStatsDiv = document.getElementById(`history-spin-stats-${gameNumber}`);
      if (spinStatsDiv) {
        const isExpanded = spinStatsDiv.style.display !== 'none';
        spinStatsDiv.style.display = isExpanded ? 'none' : 'block';
        spinStatsToggle.classList.toggle('expanded', !isExpanded);
      }
      return;
    }

    // Timestamps toggle
    const timestampsToggle = e.target.closest('.history-timestamps-toggle');
    if (timestampsToggle) {
      const gameNumber = timestampsToggle.dataset.game;
      const timestampsDiv = document.getElementById(`history-timestamps-${gameNumber}`);
      if (timestampsDiv) {
        const isExpanded = timestampsDiv.style.display !== 'none';
        timestampsDiv.style.display = isExpanded ? 'none' : 'block';
        timestampsToggle.classList.toggle('expanded', !isExpanded);
      }
      return;
    }
  });
}

/**
 * Initialize Google Sign-In button
 */
let googleSignInInitAttempts = 0;
const MAX_INIT_ATTEMPTS = 50; // 5 seconds max wait

function initializeGoogleSignIn() {
  const buttonContainer = document.getElementById('googleSignInButton');
  if (!buttonContainer) {
    console.error('Google Sign-In button container not found');
    // Try again after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeGoogleSignIn);
    }
    return;
  }

  // Wait for Google Identity Services to load
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
    // Show loading state if container is empty and we haven't tried too many times
    if (buttonContainer.children.length === 0 && googleSignInInitAttempts === 0) {
      buttonContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">Loading sign-in button...</p>';
    }
    
    googleSignInInitAttempts++;
    if (googleSignInInitAttempts < MAX_INIT_ATTEMPTS) {
      setTimeout(initializeGoogleSignIn, 100);
    } else {
      // Fallback: Show a manual button if Google script doesn't load
      console.warn('Google Identity Services script did not load after', MAX_INIT_ATTEMPTS * 100, 'ms. Showing fallback button.');
      showFallbackSignInButton(buttonContainer);
    }
    return;
  }
  
  // Clear any loading message
  if (buttonContainer.children.length === 1 && buttonContainer.textContent.includes('Loading')) {
    buttonContainer.innerHTML = '';
  }
  
  try {
    const GOOGLE_CLIENT_ID = '471918731686-11a6qm3hlqgablic5ks7u24ob5ghd800.apps.googleusercontent.com';
    console.log('Initializing Google Sign-In with Client ID:', GOOGLE_CLIENT_ID);
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
    });
    
    // Render Google's button in the hidden container
    google.accounts.id.renderButton(
      buttonContainer,
      {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: 300,
      }
    );
    
    // Once Google's button is rendered, we can keep our big button but it will click Google's
    // The big button stays visible as the main CTA
  } catch (error) {
    console.error('Error initializing Google Sign-In:', error);
    showFallbackSignInButton(buttonContainer);
  }
}

/**
 * Show a fallback sign-in button if Google's script fails
 */
function showFallbackSignInButton(container) {
  container.innerHTML = `
    <button type="button" class="fallback-signin-btn" id="fallbackSignInBtn">
      Sign in with Google
    </button>
    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px; text-align: center;">
      Google Sign-In is loading. If this persists, please refresh the page.
    </p>
  `;
  
  const fallbackBtn = document.getElementById('fallbackSignInBtn');
  if (fallbackBtn) {
    fallbackBtn.addEventListener('click', async () => {
      // Try to trigger Google Sign-In manually if it's available
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        try {
          // Use Google's One Tap or prompt
          google.accounts.id.prompt();
        } catch (err) {
          console.error('Error with Google prompt:', err);
          alert('Please refresh the page to try signing in again.');
        }
      } else {
        alert('Google Sign-In is still loading. Please wait a moment and refresh the page, or check your internet connection.');
      }
    });
  }
}

/**
 * Handle Google Sign-In callback (from ID token)
 */
async function handleGoogleSignIn(response) {
  const errorDiv = document.getElementById('loginError');
  errorDiv.style.display = 'none';
  
  try {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ credential: response.credential }),
    });
    
    const data = await res.json();
    
    if (data.ok) {
      setCurrentUser(data.user);
      // loadTombolas(); // Disabled - lobby redesigned
    } else {
      throw new Error(data.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('Sign-in error:', error);
    errorDiv.textContent = error.message || 'Sign-in failed. Please try again.';
    errorDiv.style.display = 'block';
  }
}

/**
 * Handle Google Sign-In with access token (fallback method)
 */
async function handleGoogleSignInWithToken(accessToken) {
  const errorDiv = document.getElementById('loginError');
  errorDiv.style.display = 'none';
  
  try {
    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!userInfoRes.ok) {
      throw new Error('Failed to get user info from Google');
    }
    
    const userInfo = await userInfoRes.json();
    
    // Create a mock credential-like object for the backend
    // The backend will need to handle this, but for now let's try a different approach
    // Actually, let's just trigger the normal flow by using Google's ID token flow
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      // Try to get ID token instead
      const GOOGLE_CLIENT_ID = '471918731686-11a6qm3hlqgablic5ks7u24ob5ghd800.apps.googleusercontent.com';
      console.log('Re-initializing Google Sign-In with Client ID:', GOOGLE_CLIENT_ID);
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
      });
      google.accounts.id.prompt();
    } else {
      throw new Error('Google Sign-In not available');
    }
  } catch (error) {
    console.error('Token sign-in error:', error);
    errorDiv.textContent = error.message || 'Sign-in failed. Please try again.';
    errorDiv.style.display = 'block';
  }
}

/**
 * Handle email/password login
 */
async function handleEmailLogin(event) {
  event.preventDefault();
  const errorDiv = document.getElementById('loginError');
  errorDiv.style.display = 'none';

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.ok) {
      setCurrentUser(data.user);
    } else {
      throw new Error(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = error.message || 'Login failed. Please try again.';
    errorDiv.style.display = 'block';
  }
}

/**
 * Handle email/password registration
 */
async function handleEmailRegister(event) {
  event.preventDefault();
  const errorDiv = document.getElementById('loginError');
  errorDiv.style.display = 'none';

  const fullName = document.getElementById('registerFullName').value;
  const email = document.getElementById('registerEmail').value;
  const dateOfBirth = document.getElementById('registerDateOfBirth').value;
  const password = document.getElementById('registerPassword').value;

  // Validation
  if (password.length < 8) {
    errorDiv.textContent = 'Password must be at least 8 characters long';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ fullName, email, dateOfBirth, password }),
    });

    const data = await res.json();

    if (data.ok) {
      setCurrentUser(data.user);
    } else {
      throw new Error(data.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    errorDiv.textContent = error.message || 'Registration failed. Please try again.';
    errorDiv.style.display = 'block';
  }
}

/**
 * Toggle between login and registration forms
 */
function showLoginForm() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}

/**
 * Set the current user and update UI
 * Also checks if profile needs to be completed
 */
function setCurrentUser(user) {
  // Handle null user (sign out) - do this FIRST
  if (!user) {
    appState.currentUser = null;
    const userStatus = document.getElementById('userStatus');
    const authBadge = document.getElementById('authBadge');
    if (userStatus) userStatus.textContent = 'Guest';
    if (authBadge) {
      authBadge.textContent = 'Signed Out';
      authBadge.classList.remove('signed-in');
    }
    showScreen('login');
    // Reset bottom nav
    document.querySelectorAll('.bottom-nav .nav-item')
      .forEach(i => i.classList.remove('active'));
    return; // Exit early, don't try to access user properties
  }
  
  // User is not null - proceed with normal flow
  appState.currentUser = user;
  
  const userStatus = document.getElementById('userStatus');
  const authBadge = document.getElementById('authBadge');
  
  if (userStatus) {
    userStatus.textContent = user.email || user.name || 'User';
  }
  if (authBadge) {
    authBadge.textContent = 'Signed In';
    authBadge.classList.add('signed-in');
  }

  // Load wallet and free attempts status when user is set
  loadWallet();
  loadFreeAttemptsStatus();

  // Update balance UI (legacy - deprecated)
  updateTicketsBalanceUI();

  // Check if user needs to complete profile
  const needsProfile = !user.publicName || !user.avatarUrl;

  if (needsProfile) {
    showScreen('profile');
    populateProfileForm();
    // Highlight profile nav
    document
      .querySelectorAll('.bottom-nav .nav-item')
      .forEach(i => i.classList.remove('active'));
    document
      .querySelector('.bottom-nav .nav-item[data-screen="profile-screen"]')
      ?.classList.add('active');
  } else {
    showScreen('lobby');
  }
}

/**
 * Set the current user (alias for compatibility)
 */
function setUser(user) {
  setCurrentUser(user);
}

/**
 * Populate profile form from currentUser
 */
function populateProfileForm() {
  if (!appState.currentUser) return;

  const emailEl = document.getElementById('profile-email');
  const nameInput = document.getElementById('profile-public-name');
  const avatarInput = document.getElementById('profile-avatar-url');
  const avatarImg = document.getElementById('profile-avatar-preview');
  const walletAmount = document.getElementById('wallet-amount');

  if (emailEl) emailEl.textContent = appState.currentUser.email || '';
  if (nameInput) nameInput.value = appState.currentUser.publicName || appState.currentUser.name || '';
  if (avatarInput) avatarInput.value = appState.currentUser.avatarUrl || '';
  if (avatarImg) {
    avatarImg.src = appState.currentUser.avatarUrl || appState.currentUser.picture || '';
  }
  if (walletAmount) {
    walletAmount.textContent = appState.currentUser.credits != null ? appState.currentUser.credits : 0;
  }
}

/**
 * Update tickets balance UI in both tickets screen and profile wallet
 */
function updateTicketsBalanceUI() {
  if (!appState.currentUser) return;
  
  const credits = appState.currentUser.credits != null ? appState.currentUser.credits : 0;
  
  // Update tickets screen balance
  const ticketsBalanceValue = document.getElementById('ticketsBalanceValue');
  if (ticketsBalanceValue) {
    ticketsBalanceValue.textContent = credits;
  }
  
  // Update profile wallet
  const walletAmount = document.getElementById('wallet-amount');
  if (walletAmount) {
    walletAmount.textContent = credits;
  }
}

/**
 * Append an activity entry to the tickets activity list
 */
function appendTicketActivityEntry(text) {
  const activityList = document.getElementById('ticketsActivityList');
  if (!activityList) return;
  
  // Remove "No activity yet" message if present
  if (activityList.children.length === 1 && activityList.children[0].textContent === 'No activity yet') {
    activityList.innerHTML = '';
  }
  
  // Create new activity item
  const activityItem = document.createElement('div');
  activityItem.className = 'tickets-activity-item';
  activityItem.textContent = text;
  
  // Insert at the beginning
  activityList.insertBefore(activityItem, activityList.firstChild);
  
  // Limit to last 10 entries
  while (activityList.children.length > 10) {
    activityList.removeChild(activityList.lastChild);
  }
}

/**
 * Load tickets screen and update balance
 * Now includes promotions features (free attempts and watch ad)
 */
function loadTicketsScreen() {
  if (!appState.currentUser) {
    showScreen('login');
    return;
  }
  
  // Load wallet to display 8-tier grid
  loadWallet();
  
  // Load free attempts status (promotions feature)
  loadFreeAttemptsStatus();
  
  // Update legacy balance UI (deprecated)
  updateTicketsBalanceUI();
  
  // Reset watch ad button state
  const watchAdBtn = document.getElementById('watchAdBtn');
  if (watchAdBtn) {
    watchAdBtn.disabled = false;
    watchAdBtn.textContent = 'Watch ad';
  }
}

/**
 * Load wallet from API and update state
 */
async function loadWallet() {
  if (!appState.currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/api/wallet`, {
      credentials: 'include',
    });
    const data = await res.json();

    if (data.ok && data.wallet) {
      appState.wallet = data.wallet;
      renderWalletGrid();
    } else {
      console.error('Failed to load wallet:', data.error);
    }
  } catch (error) {
    console.error('Error loading wallet:', error);
  }
}

/**
 * Render 8-tier wallet grid (2 rows × 4 columns)
 */
function renderWalletGrid() {
  const walletGrid = document.getElementById('walletGrid');
  if (!walletGrid || !appState.wallet) return;

  // Tier metadata (matching config/tickets.js)
  const tierMetadata = {
    BRONZE: { name: 'Bronze', color: '#CD7F32' },
    SILVER: { name: 'Silver', color: '#C0C0C0' },
    GOLD: { name: 'Gold', color: '#FFD700' },
    EMERALD: { name: 'Emerald', color: '#50C878' },
    SAPPHIRE: { name: 'Sapphire', color: '#0F52BA' },
    RUBY: { name: 'Ruby', color: '#E0115F' },
    AMETHYST: { name: 'Amethyst', color: '#9966CC' },
    DIAMOND: { name: 'Diamond', color: '#B9F2FF' },
  };

  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'DIAMOND'];

  walletGrid.innerHTML = '';

  tiers.forEach(tier => {
    const metadata = tierMetadata[tier];
    const balance = appState.wallet[tier] || 0;

    const card = document.createElement('div');
    card.className = 'wallet-tier-card';
    card.style.borderColor = metadata.color;
    card.style.backgroundColor = `${metadata.color}15`; // 15 = ~8% opacity

    card.innerHTML = `
      <div class="wallet-tier-name" style="color: ${metadata.color}">${metadata.name}</div>
      <div class="wallet-tier-balance">${balance}</div>
    `;

    walletGrid.appendChild(card);
  });
}

/**
 * Load free attempts status from API
 */
async function loadFreeAttemptsStatus() {
  if (!appState.currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/api/free-attempts/status`, {
      credentials: 'include',
    });
    const data = await res.json();

    if (data.ok) {
      appState.freeAttemptsStatus = data;
      updateFreeAttemptsUI();
    } else {
      console.error('Failed to load free attempts status:', data.error);
    }
  } catch (error) {
    console.error('Error loading free attempts status:', error);
  }
}

/**
 * Update free attempts UI with current status
 */
function updateFreeAttemptsUI() {
  const statusValue = document.getElementById('freeAttemptsValue');
  const playBtn = document.getElementById('freeAttemptBtn');
  const resultDiv = document.getElementById('freeAttemptsResult');

  if (!appState.freeAttemptsStatus) return;

  const { remainingAttempts, usedToday, maxPerDay } = appState.freeAttemptsStatus;

  if (statusValue) {
    statusValue.textContent = `${remainingAttempts} / ${maxPerDay}`;
  }

  if (playBtn) {
    playBtn.disabled = remainingAttempts <= 0;
    if (remainingAttempts <= 0) {
      playBtn.textContent = 'No attempts left today';
    } else {
      playBtn.textContent = 'Play Free Game';
    }
  }

  // Hide result message when status updates
  if (resultDiv) {
    resultDiv.style.display = 'none';
  }
}

/**
 * Handle free attempt play
 */
async function handleFreeAttemptPlay() {
  if (!appState.currentUser) {
    alert('Please sign in first');
    return;
  }

  const playBtn = document.getElementById('freeAttemptBtn');
  const resultDiv = document.getElementById('freeAttemptsResult');

  if (!playBtn || playBtn.disabled) return;

  playBtn.disabled = true;
  playBtn.textContent = 'Playing...';

  try {
    const res = await fetch(`${API_BASE}/api/free-attempts/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    const data = await res.json();

    if (data.ok) {
      // Update wallet if won
      if (data.won && data.wallet) {
        appState.wallet = data.wallet;
        renderWalletGrid();
      }

      // Update free attempts status
      appState.freeAttemptsStatus = {
        remainingAttempts: data.remainingAttempts,
        usedToday: 3 - data.remainingAttempts,
        maxPerDay: 3,
      };
      updateFreeAttemptsUI();

      // Show result message
      if (resultDiv) {
        if (data.won) {
          resultDiv.innerHTML = '<div class="free-attempt-win">🎉 You won 1 Bronze ticket!</div>';
          resultDiv.style.display = 'block';
          resultDiv.className = 'free-attempts-result free-attempt-win';
        } else {
          resultDiv.innerHTML = '<div class="free-attempt-lose">No ticket this time. Try again tomorrow!</div>';
          resultDiv.style.display = 'block';
          resultDiv.className = 'free-attempts-result free-attempt-lose';
        }
      }

      // Update activity log
      if (data.won) {
        appendTicketActivityEntry('+1 Bronze ticket – Free game win');
      } else {
        appendTicketActivityEntry('Free game – No win');
      }
    } else {
      throw new Error(data.error || 'Failed to play free game');
    }
  } catch (error) {
    console.error('Free attempt error:', error);
    alert(error.message || 'Something went wrong. Please try again.');
  } finally {
    // Re-enable button (status update will handle disabled state if no attempts left)
    if (playBtn) {
      playBtn.disabled = appState.freeAttemptsStatus?.remainingAttempts <= 0;
      playBtn.textContent = playBtn.disabled ? 'No attempts left today' : 'Play Free Game';
    }
  }
}

/**
 * Watch ad flow - awards 1 Bronze ticket per confirmed ad view
 * Updated to use new /api/rewards/ad endpoint
 */
let watchAdCountdown = null;

async function handleWatchAd() {
  if (!appState.currentUser) {
    alert('Please sign in first');
    return;
  }

  // Watch ad button (now in My Tickets screen)
  const watchAdBtn = document.getElementById('watchAdBtn');
  if (!watchAdBtn || watchAdBtn.disabled) return;

  // Disable button and start countdown
  watchAdBtn.disabled = true;
  let secondsLeft = 5;
  watchAdBtn.textContent = `Watching… ${secondsLeft}s`;

  watchAdCountdown = setInterval(() => {
    secondsLeft--;
    if (secondsLeft > 0) {
      watchAdBtn.textContent = `Watching… ${secondsLeft}s`;
    } else {
      clearInterval(watchAdCountdown);
      watchAdCountdown = null;
      watchAdBtn.textContent = 'Processing...';

      // Call new backend endpoint for ad rewards
      fetch(`${API_BASE}/api/rewards/ad`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            // Update wallet with new balances
            if (data.wallet) {
              appState.wallet = data.wallet;
              renderWalletGrid();
            }

            // Update legacy credits (deprecated)
            if (appState.currentUser) {
              // Legacy support - keep credits in sync for now
              const bronzeBalance = data.wallet?.BRONZE || 0;
              appState.currentUser.credits = bronzeBalance;
              updateTicketsBalanceUI();
            }

            appendTicketActivityEntry('+1 Bronze ticket – Ad reward');

            // Show success message
            alert('You earned 1 Bronze ticket!');

            // Re-enable button
            watchAdBtn.disabled = false;
            watchAdBtn.textContent = 'Watch ad';
          } else {
            throw new Error(data.error || 'Failed to award tickets');
          }
        })
        .catch(error => {
          console.error('Watch ad error:', error);
          alert('Something went wrong. Please try again.');

          // Re-enable button
          watchAdBtn.disabled = false;
          watchAdBtn.textContent = 'Watch ad';
        });
    }
  }, 1000);
}

/**
 * DEPRECATED: Show promotions screen
 * Promotions features are now merged into My Tickets screen
 * This function is kept for backward compatibility but redirects to My Tickets
 */
function showPromotionsScreen() {
  if (!appState.currentUser) {
    showScreen('login');
    return;
  }

  // Redirect to My Tickets screen (which now contains promotions)
  showScreen('tickets');
  loadFreeAttemptsStatus();
  // Update bottom nav
  document.querySelectorAll('.bottom-nav .nav-item')
    .forEach(i => i.classList.remove('active'));
  document.querySelector('.bottom-nav .nav-item[data-screen="tickets-screen"]')
    ?.classList.add('active');
}

/**
 * DEPRECATED: Legacy watch ad handler (kept for backward compatibility)
 * TODO: Remove after confirming Promotions screen works
 */
async function handleWatchAdLegacy() {
  // Redirect to new handler
  handleWatchAd();
}

/**
 * Load lobby content (wallet summary and tier game buttons)
 */
async function loadLobbyContent() {
  if (!appState.currentUser) return;

  // Load wallet summary
  await loadWalletSummary();

  // Render tier ladder
  renderTierLadder();

  // Render tier game buttons
  renderTierGameButtons();

  startBronzeLobbyLoop();
}

/**
 * Load wallet summary for lobby display
 */
async function loadWalletSummary() {
  if (!appState.currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/api/wallet`, {
      credentials: 'include',
    });
    const data = await res.json();

    if (data.ok && data.wallet) {
      appState.wallet = data.wallet;
      renderWalletSummary();
    } else {
      throw new Error('Failed to load wallet');
    }
  } catch (error) {
    console.warn('Failed to load wallet summary:', error);
    // Graceful degradation: show "—" for all tiers
    renderWalletSummary(true);
  }
}

/**
 * Render wallet summary pills (compact display)
 */
function renderWalletSummary(showPlaceholder = false) {
  const stripContainer = document.getElementById('ticketStrip');
  if (!stripContainer) return;

  // Tier metadata (matching config/tickets.js)
  const tierMetadata = {
    BRONZE: { name: 'BRONZE', color: '#CD7F32' },
    SILVER: { name: 'SILVER', color: '#C0C0C0' },
    GOLD: { name: 'GOLD', color: '#FFD700' },
    EMERALD: { name: 'EMERALD', color: '#50C878' },
    SAPPHIRE: { name: 'SAPPHIRE', color: '#0F52BA' },
    RUBY: { name: 'RUBY', color: '#E0115F' },
    AMETHYST: { name: 'AMETHYST', color: '#9966CC' },
    DIAMOND: { name: 'DIAMOND', color: '#B9F2FF' },
  };

  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'DIAMOND'];

  stripContainer.innerHTML = '';

  tiers.forEach(tier => {
    const metadata = tierMetadata[tier];
    const balance = showPlaceholder ? '—' : (appState.wallet?.[tier] || 0);

    const pill = document.createElement('div');
    pill.className = 'ticket-pill';
    pill.style.borderColor = metadata.color;
    pill.style.color = metadata.color;
    pill.setAttribute('data-tier', tier);

    pill.innerHTML = `
      <span class="ticket-pill-name">${metadata.name}</span>
      <span class="ticket-pill-count">${balance}</span>
    `;

    stripContainer.appendChild(pill);
  });

  const bronzeBalanceEl = document.getElementById('bronzeTicketBalance');
  if (bronzeBalanceEl && !showPlaceholder) {
    bronzeBalanceEl.textContent = appState.wallet?.BRONZE ?? 0;
  }
}

/**
 * Render tier ladder visualization
 */
function renderTierLadder() {
  const ladderContainer = document.getElementById('tierLadder');
  if (!ladderContainer) return;

  const tierMetadata = {
    BRONZE: { name: 'Bronze', color: '#CD7F32' },
    SILVER: { name: 'Silver', color: '#C0C0C0' },
    GOLD: { name: 'Gold', color: '#FFD700' },
    EMERALD: { name: 'Emerald', color: '#50C878' },
    SAPPHIRE: { name: 'Sapphire', color: '#0F52BA' },
    RUBY: { name: 'Ruby', color: '#E0115F' },
    AMETHYST: { name: 'Amethyst', color: '#9966CC' },
    DIAMOND: { name: 'Diamond', color: '#B9F2FF' },
  };

  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'DIAMOND'];

  ladderContainer.innerHTML = '';

  tiers.forEach((tier, index) => {
    const metadata = tierMetadata[tier];
    const tierSpan = document.createElement('span');
    tierSpan.className = 'tier-ladder-item';
    tierSpan.style.color = metadata.color;
    tierSpan.textContent = metadata.name.toUpperCase();

    ladderContainer.appendChild(tierSpan);

    // Add arrow between tiers (except after last)
    if (index < tiers.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'tier-ladder-arrow';
      arrow.textContent = ' → ';
      arrow.style.color = 'var(--text-secondary)';
      ladderContainer.appendChild(arrow);
    }
  });
}

/**
 * Render tier game buttons (Tier 1-7)
 * Note: Tier 8 (Diamond) is the final tier - no games beyond it
 */
function renderTierGameButtons() {
  const buttonsContainer = document.getElementById('tierGameButtons');
  if (!buttonsContainer) return;

  const tierMetadata = {
    1: { from: 'Bronze', to: 'Silver', tier: 'BRONZE' },
    2: { from: 'Silver', to: 'Gold', tier: 'SILVER' },
    3: { from: 'Gold', to: 'Emerald', tier: 'GOLD' },
    4: { from: 'Emerald', to: 'Sapphire', tier: 'EMERALD' },
    5: { from: 'Sapphire', to: 'Ruby', tier: 'SAPPHIRE' },
    6: { from: 'Ruby', to: 'Amethyst', tier: 'RUBY' },
    7: { from: 'Amethyst', to: 'Diamond', tier: 'AMETHYST' },
    8: { from: 'Diamond', to: null, tier: 'DIAMOND' },
  };

  buttonsContainer.innerHTML = '';

  // Tier 1-7 buttons (Tier 8/Diamond is the final tier, no games beyond it)
  for (let tierNum = 1; tierNum <= 7; tierNum++) {
    const metadata = tierMetadata[tierNum];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tier-game-btn';
    button.textContent = `Enter Tier ${tierNum} Game (${metadata.from} → ${metadata.to})`;
    button.dataset.tier = tierNum;
    button.addEventListener('click', () => handleTierGameClick(tierNum));
    buttonsContainer.appendChild(button);
  }
}

/**
 * Handle tier game button click
 * Tier 1 = Bronze lobby (implemented)
 * Other tiers = coming soon
 */
async function handleTierGameClick(tierNum) {
  // Map tier number to tier name using the same metadata as renderTierGameButtons
  const tierMetadata = {
    1: { from: 'Bronze', to: 'Silver', tier: 'BRONZE' },
    2: { from: 'Silver', to: 'Gold', tier: 'SILVER' },
    3: { from: 'Gold', to: 'Emerald', tier: 'GOLD' },
    4: { from: 'Emerald', to: 'Sapphire', tier: 'EMERALD' },
    5: { from: 'Sapphire', to: 'Ruby', tier: 'SAPPHIRE' },
    6: { from: 'Ruby', to: 'Amethyst', tier: 'RUBY' },
    7: { from: 'Amethyst', to: 'Diamond', tier: 'AMETHYST' },
    8: { from: 'Diamond', to: null, tier: 'DIAMOND' },
  };
  
  const metadata = tierMetadata[tierNum];
  if (!metadata) {
    alert(`Invalid tier number: ${tierNum}`);
    return;
  }
  
  // Set current tier and navigate to lobby page (reuse Bronze lobby structure)
  appState.currentTier = metadata.tier;
  showScreen('bronzeLobby'); // Reuse the same page structure, but make it dynamic
}

function startBronzeLobbyLoop() {
  if (!appState.currentUser) return;
  const tier = appState.currentTier || 'BRONZE'; // Default to Bronze for backward compatibility
  if (appState.tierLobbyInterval) return;
  fetchTierLobbyState(tier, true);
  appState.tierLobbyInterval = setInterval(() => fetchTierLobbyState(tier), 4000);
  appState.tierLobbyChatInterval = setInterval(() => fetchTierLobbyChat(tier), 6000);
  
  // Legacy Bronze support
  if (tier === 'BRONZE') {
    appState.bronzeLobbyInterval = appState.tierLobbyInterval;
    appState.bronzeLobbyChatInterval = appState.tierLobbyChatInterval;
  }
}

function stopBronzeLobbyLoop() {
  if (appState.tierLobbyInterval) {
    clearInterval(appState.tierLobbyInterval);
    appState.tierLobbyInterval = null;
  }
  if (appState.tierLobbyChatInterval) {
    clearInterval(appState.tierLobbyChatInterval);
    appState.tierLobbyChatInterval = null;
  }
  if (appState.tierLobbyTimerInterval) {
    clearInterval(appState.tierLobbyTimerInterval);
    appState.tierLobbyTimerInterval = null;
  }
  // Legacy Bronze support
  appState.bronzeLobbyInterval = null;
  appState.bronzeLobbyChatInterval = null;
    appState.bronzeLobbyTimerInterval = null;
}

async function fetchTierLobbyState(tier = 'BRONZE', showSkeleton = false) {
  if (!appState.currentUser) return;
  const statusEl = document.getElementById('bronzeLobbyStatus');
  if (showSkeleton && statusEl) {
    statusEl.textContent = 'Loading...';
  }
  try {
    // If user is already in a lobby, fetch that specific lobby's state
    // Otherwise, get an active lobby for the tier
    const currentLobby = appState.currentTierLobby || (tier === 'BRONZE' ? appState.bronzeLobby : null);
    const lobbyId = currentLobby?.id;
    
    let url;
    if (lobbyId) {
      // User is in a specific lobby - fetch that one
      url = `${API_BASE}/api/lobbies/${lobbyId}/state`;
    } else {
      // User not in a lobby yet - get an active one
      url = `${API_BASE}/api/lobbies/active?tier=${tier}`;
    }
    
    const res = await fetch(url, {
      credentials: 'include',
    });
    const data = await res.json();
    if (data.ok) {
      appState.currentTierLobby = data.lobby;
      // Legacy Bronze support
      if (tier === 'BRONZE') {
      appState.bronzeLobby = data.lobby;
      }
      const myPlayer = getTierPlayer(tier);
      if (appState.tierSelectedNumber == null && myPlayer?.luckyNumber) {
        appState.tierSelectedNumber = myPlayer.luckyNumber;
        if (tier === 'BRONZE') {
        appState.bronzeSelectedNumber = myPlayer.luckyNumber;
      }
      }
      renderTierLobby(tier);
      fetchTierLobbyChat(tier); // refresh chat after state load
    } else {
      throw new Error(data.error || 'Failed to load lobby');
    }
  } catch (error) {
    console.warn(`Failed to load ${tier} lobby:`, error);
    setBronzeStatusMessage(error.message || 'Unable to load lobby');
  }
}

// Legacy function for backward compatibility
async function fetchBronzeLobbyState(showSkeleton = false) {
  return fetchTierLobbyState('BRONZE', showSkeleton);
}

async function fetchTierLobbyChat(tier = 'BRONZE') {
  const lobby = appState.currentTierLobby || (tier === 'BRONZE' ? appState.bronzeLobby : null);
  if (!appState.currentUser || !lobby?.id) return;
  try {
    const res = await fetch(`${API_BASE}/api/lobbies/${lobby.id}/chat`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (data.ok) {
      appState.tierLobbyChat = data.messages || [];
      if (tier === 'BRONZE') {
      appState.bronzeLobbyChat = data.messages || [];
      }
      renderBronzeChat();
    }
  } catch (error) {
    console.warn(`Failed to load ${tier} chat:`, error);
  }
}

// Legacy function
async function fetchBronzeLobbyChat() {
  return fetchTierLobbyChat('BRONZE');
}

function renderTierLobby(tier = null) {
  const currentTier = tier || appState.currentTier || 'BRONZE';
  updateTierLobbyHeader(currentTier);
  renderBronzeInfo(); // Reuse existing function (it uses appState.bronzeLobby or appState.currentTierLobby)
  renderBronzeScoreboard();
  renderBronzePicker();
  renderBronzeWheel();
  renderBronzeChat();
}

function renderBronzeLobby() {
  // Legacy function - use renderTierLobby for new code
  renderTierLobby('BRONZE');
}

function updateTierLobbyHeader(tier) {
  const headerTitle = document.querySelector('.bronze-lobby-header h2');
  const headerDesc = document.querySelector('.bronze-lobby-header p');
  const ticketLabel = document.querySelector('.bronze-ticket-summary span');
  const ticketBalance = document.getElementById('bronzeTicketBalance');
  const joinButton = document.getElementById('bronzeJoinButton');
  
  // Use inline metadata (can't use require in browser)
  const tierMetadata = {
    BRONZE: { name: 'Bronze', color: '#CD7F32' },
    SILVER: { name: 'Silver', color: '#C0C0C0' },
    GOLD: { name: 'Gold', color: '#FFD700' },
    EMERALD: { name: 'Emerald', color: '#50C878' },
    SAPPHIRE: { name: 'Sapphire', color: '#0F52BA' },
    RUBY: { name: 'Ruby', color: '#E0115F' },
    AMETHYST: { name: 'Amethyst', color: '#9966CC' },
    DIAMOND: { name: 'Diamond', color: '#B9F2FF' },
  };
  
  const metadata = tierMetadata[tier] || tierMetadata.BRONZE;
  
  if (headerTitle) headerTitle.textContent = `${metadata.name} Tier Lobby`;
  if (headerDesc) headerDesc.textContent = `Stake 1 ${metadata.name} ticket, pick a lucky number, and power the Wheel of Fortune.`;
  if (ticketLabel) ticketLabel.textContent = `${metadata.name} tickets`;
  if (ticketBalance && appState.wallet) {
    ticketBalance.textContent = appState.wallet[tier] ?? 0;
  }
  if (joinButton) joinButton.textContent = `Enter ${metadata.name} Lobby`;
}

function updateBronzeTicketBalance() {
  const bronzeBalanceEl = document.getElementById('bronzeTicketBalance');
  if (bronzeBalanceEl && appState.wallet) {
    const currentTier = appState.currentTier || 'BRONZE';
    bronzeBalanceEl.textContent = appState.wallet[currentTier] ?? 0;
  }
}

function renderBronzeInfo() {
  const lobby = appState.currentTierLobby || appState.bronzeLobby;
  const statusEl = document.getElementById('bronzeLobbyStatus');
  const playerCountEl = document.getElementById('bronzeLobbyPlayerCount');
  const timerEl = document.getElementById('bronzeLobbyTimer');
  const spinForceEl = document.getElementById('bronzeLobbySpinForce');

  if (!statusEl || !playerCountEl || !timerEl || !spinForceEl) return;

  if (!lobby) {
    statusEl.textContent = 'LOADING';
    playerCountEl.textContent = '— / —';
    timerEl.textContent = 'Loading...';
    spinForceEl.textContent = '—';
    return;
  }

  statusEl.textContent = lobby.status;
  statusEl.dataset.status = lobby.status.toLowerCase();
  playerCountEl.textContent = `${lobby.playerCount} / ${lobby.maxPlayers}`;

  // Update Bronze ticket balance when rendering
  updateBronzeTicketBalance();

  if (appState.tierLobbyTimerInterval) {
    clearInterval(appState.tierLobbyTimerInterval);
    appState.tierLobbyTimerInterval = null;
  }
  if (appState.bronzeLobbyTimerInterval) {
    clearInterval(appState.bronzeLobbyTimerInterval);
    appState.bronzeLobbyTimerInterval = null;
  }

  if (lobby.status === 'COUNTDOWN' && lobby.countdownEndsAt) {
    updateBronzeTimer(timerEl, lobby.countdownEndsAt);
    appState.tierLobbyTimerInterval = setInterval(() => updateBronzeTimer(timerEl, lobby.countdownEndsAt), 1000);
    if (appState.currentTier === 'BRONZE' || !appState.currentTier) {
      appState.bronzeLobbyTimerInterval = appState.tierLobbyTimerInterval;
    }
  } else if (lobby.status === 'SPINNING') {
    // Don't show countdown during spinning - wheel physics controls when it stops
    timerEl.textContent = 'Spinning...';
  } else if (lobby.status === 'RESOLVED') {
    timerEl.textContent = 'Resolved';
  } else {
    timerEl.textContent = 'Waiting for players';
  }

  const spinForceFinal = lobby.round?.spinForceFinal || null;
  spinForceEl.textContent = spinForceFinal ? `${spinForceFinal}` : '—';
}

function updateBronzeTimer(el, targetIso, prefix = '') {
  const target = new Date(targetIso);
  const now = new Date();
  const diff = Math.max(0, target - now);
  if (diff <= 0) {
    el.textContent = `${prefix}0s`;
    return;
  }
  const seconds = Math.floor(diff / 1000);
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    el.textContent = `${prefix}${mins}m ${secs}s`;
  } else {
    el.textContent = `${prefix}${seconds}s`;
  }
}

function renderBronzeScoreboard() {
  const container = document.getElementById('bronzeLobbyScoreboard');
  if (!container) return;

  const lobby = appState.currentTierLobby || appState.bronzeLobby;
  if (!lobby) {
    container.innerHTML = '<div class="bronze-empty-row">Loading lobby...</div>';
    return;
  }

  const players = lobby.players || [];
  if (players.length === 0) {
    container.innerHTML = '<div class="bronze-empty-row">No players yet. Be the first to enter!</div>';
    return;
  }

  container.innerHTML = players.map(player => {
    const lucky = player.luckyNumber != null ? player.luckyNumber : '❔';
    const youTag = player.isYou ? '<span class="bronze-you-tag">YOU</span>' : '';
    return `
      <div class="bronze-score-row ${player.isYou ? 'is-you' : ''}">
        <div class="bronze-player-meta">
          <div class="bronze-avatar" style="background-image: url('${player.avatar || ''}')"></div>
          <div>
            <div class="bronze-player-name">
              ${escapeHtml(player.displayName)} ${youTag}
            </div>
            <div class="bronze-player-joined">${formatTimeAgo(player.joinedAt)}</div>
          </div>
        </div>
        <div class="bronze-player-number">${lucky}</div>
      </div>
    `;
  }).join('');
}

function renderBronzePicker() {
  const buttonsContainer = document.getElementById('bronzeNumberButtons');
  const actionButton = document.getElementById('bronzeJoinButton');
  const helperText = document.getElementById('bronzePickerHelper');
  const errorEl = document.getElementById('bronzeLuckyError');
  if (!buttonsContainer || !actionButton || !helperText || !errorEl) return;

  // Get current tier (default to BRONZE for backward compatibility)
  const currentTier = appState.currentTier || 'BRONZE';
  const lobby = appState.currentTierLobby || appState.bronzeLobby;
  const tierBalance = appState.wallet?.[currentTier] ?? 0;
  const player = getTierPlayer(currentTier);
  const status = lobby?.status || 'WAITING';

  // Use tier-aware selected number, fallback to bronze for backward compatibility
  const selectedNumber = appState.tierSelectedNumber ?? 
    (currentTier === 'BRONZE' ? appState.bronzeSelectedNumber : null);

  if (selectedNumber == null && lobby?.luckyNumberRange) {
    appState.tierSelectedNumber = player?.luckyNumber || lobby.luckyNumberRange.min;
    if (currentTier === 'BRONZE') {
      appState.bronzeSelectedNumber = appState.tierSelectedNumber;
    }
  }

  const selectable = status === 'WAITING';
  const canJoin = selectable && tierBalance > 0;
  const numbers = [];
  const min = lobby?.luckyNumberRange?.min ?? 2;
  const max = lobby?.luckyNumberRange?.max ?? 9;
  for (let num = min; num <= max; num++) {
    numbers.push(num);
  }

  const currentSelected = appState.tierSelectedNumber ?? 
    (currentTier === 'BRONZE' ? appState.bronzeSelectedNumber : null);

  buttonsContainer.innerHTML = numbers.map(num => `
    <button type="button" class="bronze-number-btn ${currentSelected === num ? 'selected' : ''} ${!selectable ? 'disabled' : ''}" data-number="${num}" ${!selectable ? 'disabled' : ''}>
      ${num}
    </button>
  `).join('');

  // Get tier name for display
  const tierMetadata = {
    BRONZE: { name: 'Bronze' },
    SILVER: { name: 'Silver' },
    GOLD: { name: 'Gold' },
    EMERALD: { name: 'Emerald' },
    SAPPHIRE: { name: 'Sapphire' },
    RUBY: { name: 'Ruby' },
    AMETHYST: { name: 'Amethyst' },
    DIAMOND: { name: 'Diamond' },
  };
  const tierName = tierMetadata[currentTier]?.name || 'Bronze';

  if (!selectable) {
    actionButton.disabled = true;
    helperText.textContent = 'Lucky numbers lock once countdown begins.';
  } else if (!player && tierBalance <= 0) {
    actionButton.disabled = true;
    helperText.innerHTML = `You need 1 ${tierName} ticket. <button type="button" class="bronze-cta-link" id="bronzeGetTicketsBtn">Get ${tierName} Tickets</button>`;
    setTimeout(() => {
      const cta = document.getElementById('bronzeGetTicketsBtn');
      if (cta) {
        cta.addEventListener('click', () => document.getElementById('getBronzeBtn')?.click());
      }
    }, 0);
  } else {
    actionButton.disabled = !canJoin;
    helperText.textContent = player ? 'Update your lucky number before the countdown starts.' : 'Pick a lucky number and enter the lobby.';
  }

  actionButton.textContent = player ? 'Update Lucky Number' : `Enter ${tierName} Lobby`;
  clearBronzeError();
}

function renderBronzeWheel() {
  const spinForceEl = document.getElementById('bronzeSpinForceFinal');
  const winningNumberEl = document.getElementById('bronzeWinningNumber');
  const wheelGraphic = document.getElementById('bronzeWheelGraphic');
  if (!spinForceEl || !winningNumberEl || !wheelGraphic) return;

  const currentTier = appState.currentTier || 'BRONZE';
  const lobby = appState.currentTierLobby || appState.bronzeLobby;
  if (!lobby) {
    spinForceEl.textContent = '—';
    winningNumberEl.textContent = '—';
    wheelGraphic.classList.remove('spinning');
    renderWheelSegments(wheelGraphic, null, null, null);
    return;
  }

  const status = lobby.status;
  const backendWinningNumber = lobby.round?.winningNumber;
  spinForceEl.textContent = lobby.round?.spinForceFinal ?? '—';
  
  // Winning number is determined by what's under the arrow in real-time
  // Only use backend value if wheel has stopped and been resolved
  if (status === 'RESOLVED' && backendWinningNumber) {
    winningNumberEl.textContent = backendWinningNumber;
  } else if (status === 'SPINNING' || status === 'COUNTDOWN') {
    // Show real-time winning number (what's currently under the arrow)
    const currentSegment = appState.wheelState.isSpinning 
      ? getSegmentUnderArrow(appState.wheelState.currentRotation)
      : (status === 'COUNTDOWN' ? null : getSegmentUnderArrow(appState.wheelState.currentRotation || 0));
    winningNumberEl.textContent = currentSegment ?? '??';
  } else {
    winningNumberEl.textContent = '??';
  }

  // Get player's position in lobby for red marker
  const player = getTierPlayer(currentTier);
  let playerSegmentNumber = null;
  if (player && lobby.players) {
    // Find player's index in the sorted players array (by joinedAt)
    const sortedPlayers = [...lobby.players].sort((a, b) => {
      const aTime = new Date(a.joinedAt || 0).getTime();
      const bTime = new Date(b.joinedAt || 0).getTime();
      return aTime - bTime;
    });
    const playerIndex = sortedPlayers.findIndex(p => p.isYou);
    if (playerIndex >= 0) {
      // Player's segment is their position (1-20), wrapping around
      playerSegmentNumber = (playerIndex % 20) + 1;
    }
  }

  // Only re-render segments if needed (status changed, or first render)
  // Don't re-render during spinning as it resets the rotation
  const shouldRenderSegments = !appState.wheelState.isSpinning && 
    (!wheelGraphic.querySelector('.wheel-svg') || 
     wheelGraphic.getAttribute('data-last-status') !== status ||
     wheelGraphic.getAttribute('data-last-player-segment') !== String(playerSegmentNumber || ''));
  
  if (shouldRenderSegments) {
    // Only highlight winning segment if resolved, otherwise highlight will be updated in real-time
    const segmentToHighlight = (status === 'RESOLVED' ? backendWinningNumber : null);
    renderWheelSegments(wheelGraphic, segmentToHighlight, status, playerSegmentNumber);
    wheelGraphic.setAttribute('data-last-status', status);
    wheelGraphic.setAttribute('data-last-player-segment', String(playerSegmentNumber || ''));
  }
  
  // Update current segment highlight in real-time if spinning
  if (status === 'SPINNING' && appState.wheelState.isSpinning) {
    const currentSegment = getSegmentUnderArrow(appState.wheelState.currentRotation);
    updateCurrentSegmentHighlight(wheelGraphic, currentSegment);
  }

  if (status === 'SPINNING') {
    wheelGraphic.classList.add('spinning');
    // Start physics-based spinning if not already spinning
    if (!appState.wheelState.isSpinning) {
      const spinForceTotal = lobby.round?.spinForceTotal || 0;
      startWheelPhysics(wheelGraphic, spinForceTotal, winningNumberEl);
    } else {
      // Already spinning - update winning number and highlight in real-time
      const currentSegment = getSegmentUnderArrow(appState.wheelState.currentRotation);
      winningNumberEl.textContent = currentSegment ?? '??';
      // Update highlighted segment in real-time
      updateCurrentSegmentHighlight(wheelGraphic, currentSegment);
    }
  } else if (status === 'RESOLVED') {
    // Only stop if the wheel has naturally stopped, otherwise let it continue
    if (!appState.wheelState.isSpinning || appState.wheelState.currentSpeed <= 0.1) {
      // Wheel has stopped, preserve final position
      stopWheelPhysics();
    wheelGraphic.classList.remove('spinning');
      // Preserve the wheel's final rotation - don't reset it
      const svg = wheelGraphic.querySelector('.wheel-svg');
      if (svg && appState.wheelState.currentRotation !== undefined) {
        // Keep the wheel at its final position
        svg.style.transform = `rotate(${appState.wheelState.currentRotation}deg)`;
        svg.style.transition = 'none';
      }
      // Use final wheel position for winning number (more accurate than backend)
      const finalNumber = getSegmentUnderArrow(appState.wheelState.currentRotation);
      winningNumberEl.textContent = finalNumber ?? '??';
      // Highlight winning segment
      if (finalNumber) {
        highlightWinningSegment(wheelGraphic, finalNumber);
      }
  } else {
      // Wheel is still spinning, let it continue until it stops naturally
      // Keep updating the display
      const currentSegment = getSegmentUnderArrow(appState.wheelState.currentRotation);
      winningNumberEl.textContent = currentSegment ?? '??';
      updateCurrentSegmentHighlight(wheelGraphic, currentSegment);
    }
  } else {
    // Stop any spinning and reset only if not already resolved
    if (status !== 'RESOLVED') {
      stopWheelPhysics();
    wheelGraphic.classList.remove('spinning');
      appState.wheelState.currentRotation = 0;
      const svg = wheelGraphic.querySelector('.wheel-svg');
      if (svg) {
        svg.style.transform = 'rotate(0deg)';
        svg.style.transition = 'none';
      }
      winningNumberEl.textContent = '??';
    }
  }
}

/**
 * Render 20 segments on the wheel with numbers 1-20
 * @param {HTMLElement} container - Container element
 * @param {number|null} winningNumber - Winning number (if resolved)
 * @param {string|null} status - Lobby status
 * @param {number|null} playerSegmentNumber - Player's segment number (1-20) based on lobby position
 */
function renderWheelSegments(container, winningNumber, status, playerSegmentNumber) {
  if (!container) return;
  
  // Remove existing SVG if present
  const existingSvg = container.querySelector('svg');
  if (existingSvg) {
    existingSvg.remove();
  }

  const size = 120;
  const center = size / 2;
  const radius = size / 2 - 2;
  const segmentAngle = 360 / 20; // 18 degrees per segment

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.zIndex = '1';
  svg.setAttribute('class', 'wheel-svg');

  // Create segments
  for (let i = 0; i < 20; i++) {
    const number = i + 1;
    const startAngle = (i * segmentAngle - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * segmentAngle - 90) * (Math.PI / 180);
    
    const isWinning = winningNumber === number;
    const isPlayerSegment = playerSegmentNumber === number;
    // Current segment is determined dynamically during spinning, not hardcoded
    // We'll update it in real-time via updateCurrentSegmentHighlight
    const isCurrentSegment = false; // Will be updated dynamically
    
    // Create path for segment
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    
    const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
    path.setAttribute('d', pathData);
    
    // Determine fill color
    let fillColor;
    if (isWinning) {
      fillColor = 'rgba(124, 252, 0, 0.3)';
    } else if (isCurrentSegment && status !== 'RESOLVED') {
      fillColor = 'rgba(0, 255, 255, 0.4)'; // Glow for current segment
    } else if (isPlayerSegment) {
      fillColor = 'rgba(255, 0, 0, 0.2)'; // Red tint for player segment
    } else {
      fillColor = i % 2 === 0 
        ? 'rgba(0, 255, 255, 0.15)' 
        : 'rgba(157, 78, 221, 0.15)';
    }
    
    path.setAttribute('fill', fillColor);
    path.setAttribute('stroke', isWinning 
      ? 'rgba(124, 252, 0, 0.6)' 
      : isCurrentSegment && status !== 'RESOLVED'
        ? 'rgba(0, 255, 255, 0.8)'
        : 'rgba(255, 255, 255, 0.1)');
    path.setAttribute('stroke-width', isWinning || (isCurrentSegment && status !== 'RESOLVED') ? '2' : '0.5');
    path.setAttribute('data-segment', number);
    path.setAttribute('class', [
      isWinning ? 'winning-segment' : '',
      isCurrentSegment && status !== 'RESOLVED' ? 'current-segment' : '',
      isPlayerSegment ? 'player-segment' : '',
    ].filter(Boolean).join(' '));
    svg.appendChild(path);

    // Add number text - always upright (counter-rotate)
    const textAngle = (i * segmentAngle + segmentAngle / 2 - 90) * (Math.PI / 180);
    const textRadius = radius * 0.7;
    const textX = center + textRadius * Math.cos(textAngle);
    const textY = center + textRadius * Math.sin(textAngle);
    
    // Create a group for the text so we can counter-rotate it
    // Store the base counter-rotation in a data attribute for later updates
    const baseCounterRot = -i * segmentAngle - segmentAngle / 2 + 90;
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('transform', `translate(${textX}, ${textY}) rotate(${baseCounterRot})`);
    textGroup.setAttribute('data-base-rot', baseCounterRot.toString());
    textGroup.setAttribute('data-segment', number.toString());
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '0');
    text.setAttribute('y', '0');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', isWinning ? '700' : '500');
    text.setAttribute('fill', isWinning ? '#7cfc00' : '#ffffff');
    text.textContent = number;
    textGroup.appendChild(text);
    svg.appendChild(textGroup);

    // Add red marker for player's segment (small dot on the outer edge)
    if (isPlayerSegment) {
      const markerAngle = (i * segmentAngle + segmentAngle / 2 - 90) * (Math.PI / 180);
      const markerRadius = radius - 2;
      const markerX = center + markerRadius * Math.cos(markerAngle);
      const markerY = center + markerRadius * Math.sin(markerAngle);
      
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('cx', markerX);
      marker.setAttribute('cy', markerY);
      marker.setAttribute('r', '3');
      marker.setAttribute('fill', '#ff0000');
      marker.setAttribute('stroke', '#ffffff');
      marker.setAttribute('stroke-width', '1');
      marker.setAttribute('class', 'player-marker');
      svg.appendChild(marker);
    }
  }

  container.appendChild(svg);
}

/**
 * Highlight the winning segment
 */
function highlightWinningSegment(container, winningNumber) {
  const svg = container.querySelector('svg');
  if (!svg) return;
  
  // Remove previous highlights
  svg.querySelectorAll('.winning-segment').forEach(el => {
    el.classList.remove('winning-segment');
    const segmentNum = parseInt(el.getAttribute('data-segment'));
    const isEven = segmentNum % 2 === 0;
    el.setAttribute('fill', isEven 
      ? 'rgba(0, 255, 255, 0.15)' 
      : 'rgba(157, 78, 221, 0.15)');
    el.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
    el.setAttribute('stroke-width', '0.5');
  });
  
  // Highlight winning segment
  const segment = svg.querySelector(`path[data-segment="${winningNumber}"]`);
  if (segment) {
    segment.classList.add('winning-segment');
    segment.setAttribute('fill', 'rgba(124, 252, 0, 0.4)');
    segment.setAttribute('stroke', 'rgba(124, 252, 0, 0.8)');
    segment.setAttribute('stroke-width', '2');
  }
  
  // Highlight winning number text
  const allTextGroups = svg.querySelectorAll('g');
  allTextGroups.forEach(group => {
    const text = group.querySelector('text');
    if (text) {
      const textNum = parseInt(text.textContent);
      if (textNum === winningNumber) {
        text.setAttribute('fill', '#7cfc00');
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-size', '12');
      } else {
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('font-weight', '500');
        text.setAttribute('font-size', '10');
      }
    }
  });
  
  // Remove current segment glow when resolved
  svg.querySelectorAll('.current-segment').forEach(el => {
    el.classList.remove('current-segment');
  });
}

/**
 * Start physics-based wheel spinning
 * @param {HTMLElement} wheelGraphic - Wheel container element
 * @param {number} spinForceTotal - Initial spin force (degrees per second)
 * @param {HTMLElement} winningNumberEl - Element to display current winning number
 */
function startWheelPhysics(wheelGraphic, spinForceTotal, winningNumberEl) {
  // Stop any existing spin and reset state
  stopWheelPhysics();
  appState.wheelState.winningSegmentReported = false; // Reset for new spin
  
  const svg = wheelGraphic.querySelector('.wheel-svg');
  if (!svg) return;
  
  // Multiply the spin force to make it much stronger
  // spinForceTotal is typically 20-180 (sum of lucky numbers 2-9 for 20 players)
  // Multiply by 50 to get 1000-9000 degrees per second initial speed
  const FORCE_MULTIPLIER = 50;
  const initialSpeed = spinForceTotal * FORCE_MULTIPLIER; // degrees per second
  
  // Deceleration rate: aggressive deceleration (3x more than before)
  // This creates a strong initial spin that decelerates quickly
  const DECELERATION_RATE = Math.max(6, initialSpeed * 0.06); // 6% of initial speed per second (3x more aggressive), minimum 6
  
  // Initialize state
  appState.wheelState.isSpinning = true;
  appState.wheelState.currentRotation = 0;
  appState.wheelState.currentSpeed = initialSpeed; // degrees per second
  appState.wheelState.lastUpdateTime = Date.now();
  appState.wheelState.decelerationRate = DECELERATION_RATE;
  appState.wheelState.winningSegmentReported = false; // Track if we've already reported the winning segment
  
  // Apply initial rotation
  svg.style.transform = `rotate(0deg)`;
  svg.style.transition = 'none';
  
  // Start physics loop (60 FPS)
  function updateWheel() {
    if (!appState.wheelState.isSpinning) return;
    
    const now = Date.now();
    const deltaTime = (now - appState.wheelState.lastUpdateTime) / 1000; // seconds
    appState.wheelState.lastUpdateTime = now;
    
    // Update rotation based on current speed
    appState.wheelState.currentRotation += appState.wheelState.currentSpeed * deltaTime;
    
    // Normalize rotation to 0-360 range
    appState.wheelState.currentRotation = appState.wheelState.currentRotation % 360;
    if (appState.wheelState.currentRotation < 0) {
      appState.wheelState.currentRotation += 360;
    }
    
    // Apply rotation to SVG
    svg.style.transform = `rotate(${appState.wheelState.currentRotation}deg)`;
    
    // Update text rotations to keep numbers upright
    // Counter-rotate text groups by the wheel's rotation to keep them upright
    const textGroups = svg.querySelectorAll('g[data-base-rot]');
    textGroups.forEach(group => {
      const baseRot = parseFloat(group.getAttribute('data-base-rot'));
      const currentTransform = group.getAttribute('transform') || '';
      const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
      if (translateMatch) {
        const [x, y] = translateMatch[1].split(',').map(v => parseFloat(v.trim()));
        // Counter-rotate by the wheel's rotation to keep text upright
        const newCounterRot = baseRot - appState.wheelState.currentRotation;
        group.setAttribute('transform', `translate(${x}, ${y}) rotate(${newCounterRot})`);
      }
    });
    
    // Decrease speed by deceleration rate per second
    // Since we're updating at 60 FPS, decrease proportionally per frame
    appState.wheelState.currentSpeed = Math.max(0, appState.wheelState.currentSpeed - (appState.wheelState.decelerationRate * deltaTime));
    
    // Update winning number display in real-time (what's currently under the arrow)
    const currentSegment = getSegmentUnderArrow(appState.wheelState.currentRotation);
    if (winningNumberEl) {
      winningNumberEl.textContent = currentSegment ?? '??';
    }
    
    // Update highlighted segment in real-time as wheel spins
    updateCurrentSegmentHighlight(wheelGraphic, currentSegment);
    
    // Check if wheel has stopped (speed must be very close to 0)
    // Only report winning segment once when speed reaches near-zero
    if (appState.wheelState.currentSpeed <= 0.05 && !appState.wheelState.winningSegmentReported) {
      // Wheel has truly stopped - determine winning segment
      appState.wheelState.currentSpeed = 0;
      appState.wheelState.winningSegmentReported = true;
      
      // The winning number is now determined by the final position
      const finalSegment = getSegmentUnderArrow(appState.wheelState.currentRotation);
      if (winningNumberEl) {
        winningNumberEl.textContent = finalSegment ?? '??';
      }
      
      // Final highlight update
      updateCurrentSegmentHighlight(wheelGraphic, finalSegment);
      
      // Report winning segment to backend (only once)
      reportWinningSegment(finalSegment);
      
      // Stop the physics loop
      stopWheelPhysics();
      
      // Preserve the final rotation - don't reset it
    } else if (appState.wheelState.currentSpeed > 0.05) {
      // Continue spinning - only continue if speed is above threshold
      appState.wheelState.spinInterval = requestAnimationFrame(updateWheel);
    } else {
      // Speed is at or below 0.05 but already reported - ensure it stays stopped
      appState.wheelState.currentSpeed = 0;
      stopWheelPhysics();
    }
  }
  
  // Start the physics loop
  appState.wheelState.spinInterval = requestAnimationFrame(updateWheel);
}

/**
 * Update the highlighted segment in real-time as the wheel spins
 */
function updateCurrentSegmentHighlight(wheelGraphic, segmentNumber) {
  if (!wheelGraphic || !segmentNumber) return;
  
  const svg = wheelGraphic.querySelector('.wheel-svg');
  if (!svg) return;
  
  // Remove all current-segment highlights
  svg.querySelectorAll('.current-segment').forEach(path => {
    path.classList.remove('current-segment');
    const segmentNum = parseInt(path.getAttribute('data-segment'));
    const isEven = segmentNum % 2 === 0;
    path.setAttribute('fill', isEven 
      ? 'rgba(0, 255, 255, 0.15)' 
      : 'rgba(157, 78, 221, 0.15)');
    path.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
    path.setAttribute('stroke-width', '0.5');
  });
  
  // Highlight the current segment under the arrow
  const currentPath = svg.querySelector(`path[data-segment="${segmentNumber}"]`);
  if (currentPath) {
    currentPath.classList.add('current-segment');
    currentPath.setAttribute('fill', 'rgba(0, 255, 255, 0.4)');
    currentPath.setAttribute('stroke', 'rgba(0, 255, 255, 0.8)');
    currentPath.setAttribute('stroke-width', '2');
  }
}

/**
 * Report winning segment to backend when wheel stops
 */
async function reportWinningSegment(winningSegment) {
  const currentTier = appState.currentTier || 'BRONZE';
  const lobby = appState.currentTierLobby || appState.bronzeLobby;
  if (!lobby || !lobby.id || !winningSegment) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/lobbies/${lobby.id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        winningSegment: winningSegment,
        winningNumber: winningSegment,
      }),
    });
    
    const data = await response.json();
    if (data.ok) {
      console.log('[wheel] Winning segment reported to backend:', winningSegment);
      // Refresh lobby state to get updated status
      if (appState.tierLobbyInterval) {
        // Trigger immediate refresh
        const tier = appState.currentTier || 'BRONZE';
        fetchTierLobbyState(tier);
      }
    } else {
      console.error('[wheel] Failed to report winning segment:', data.error);
    }
  } catch (error) {
    console.error('[wheel] Error reporting winning segment:', error);
  }
}

/**
 * Stop wheel physics
 */
function stopWheelPhysics() {
  appState.wheelState.isSpinning = false;
  if (appState.wheelState.spinInterval) {
    cancelAnimationFrame(appState.wheelState.spinInterval);
    appState.wheelState.spinInterval = null;
  }
  appState.wheelState.currentSpeed = 0;
  // Don't reset winningSegmentReported here - it should persist until a new spin starts
  
  // Final update of text rotations to keep them upright at final position
  const wheelGraphic = document.getElementById('bronzeWheelGraphic');
  if (wheelGraphic) {
    const svg = wheelGraphic.querySelector('.wheel-svg');
    if (svg && appState.wheelState.currentRotation !== undefined) {
      const textGroups = svg.querySelectorAll('g[data-base-rot]');
      textGroups.forEach(group => {
        const baseRot = parseFloat(group.getAttribute('data-base-rot'));
        const currentTransform = group.getAttribute('transform') || '';
        const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
        if (translateMatch) {
          const [x, y] = translateMatch[1].split(',').map(v => parseFloat(v.trim()));
          const newCounterRot = baseRot - appState.wheelState.currentRotation;
          group.setAttribute('transform', `translate(${x}, ${y}) rotate(${newCounterRot})`);
        }
      });
    }
  }
}

/**
 * Robust segment detection using raycast/collision detection
 * The arrow is a fixed point at the top center (0 degrees)
 * We cast a ray from the center to the arrow point and detect which segment it intersects
 * @param {number} rotation - Current wheel rotation in degrees (clockwise)
 * @returns {number} Segment number (1-20)
 */
function getSegmentUnderArrow(rotation) {
  // Arrow is fixed at the top center of the wheel
  // In SVG coordinates: top center = (centerX, 0) = (60, 0) for a 120px wheel
  // In polar coordinates: angle = -90 degrees (pointing up)
  
  const wheelGraphic = document.getElementById('bronzeWheelGraphic');
  if (!wheelGraphic) {
    // Fallback to mathematical calculation if wheel element not found
    return getSegmentUnderArrowMath(rotation);
  }
  
  const svg = wheelGraphic.querySelector('.wheel-svg');
  if (!svg) {
    return getSegmentUnderArrowMath(rotation);
  }
  
  // Get wheel dimensions
  const size = 120;
  const center = size / 2;
  const radius = size / 2 - 2;
  const segmentAngle = 360 / 20; // 18 degrees per segment
  
  // Arrow point in screen coordinates (fixed at top center)
  const arrowX = center;
  const arrowY = 0; // Top of the wheel
  
  // Convert arrow point to wheel's local coordinate system
  // The wheel is rotated by 'rotation' degrees clockwise
  // To find what's under the arrow, we need to rotate the arrow point backwards
  const normalizedRotation = rotation % 360;
  const rotationRad = (-normalizedRotation * Math.PI) / 180; // Negative because we're rotating backwards
  
  // Rotate arrow point around wheel center to get its position in original wheel coordinates
  const dx = arrowX - center;
  const dy = arrowY - center;
  const rotatedX = dx * Math.cos(rotationRad) - dy * Math.sin(rotationRad) + center;
  const rotatedY = dx * Math.sin(rotationRad) + dy * Math.cos(rotationRad) + center;
  
  // Calculate angle from center to rotated arrow point
  const angleToArrow = Math.atan2(rotatedY - center, rotatedX - center);
  // Convert to degrees and normalize to 0-360 (where 0 = right, 90 = down, -90 = up)
  let angleDeg = (angleToArrow * 180) / Math.PI;
  // Convert to 0-360 range where -90 (top) = 270
  if (angleDeg < 0) angleDeg += 360;
  
  // Segment 1 starts at -90 degrees (top) = 270 degrees in 0-360
  // Each segment spans 18 degrees
  // Find which segment contains this angle
  // Segment i spans from 270 + (i-1)*18 to 270 + i*18 degrees
  
  // Normalize angle to find which segment it's in
  let segmentAngleInWheel = (angleDeg - 270 + 360) % 360;
  
  // Calculate segment index (0-19)
  let segmentIndex = Math.floor(segmentAngleInWheel / segmentAngle);
  
  // Handle edge case: if angle is exactly at 270 (top), it's segment 1
  if (segmentAngleInWheel === 0 || segmentAngleInWheel >= 360 - segmentAngle / 2) {
    segmentIndex = 0;
  }
  
  // Normalize to 0-19
  segmentIndex = segmentIndex % 20;
  if (segmentIndex < 0) segmentIndex += 20;
  
  const segmentNumber = segmentIndex + 1;
  
  // Verify by checking if the arrow point is within the segment's bounds
  // This adds robustness - we can check if the point is actually inside the segment path
  const segmentPath = svg.querySelector(`path[data-segment="${segmentNumber}"]`);
  if (segmentPath) {
    // Use SVG's point-in-path check for additional verification
    const point = svg.createSVGPoint();
    point.x = arrowX;
    point.y = arrowY;
    // Note: isPointInFill requires the path to be in screen coordinates, not rotated
    // Since we're checking the rotated position, we need to account for the SVG's transform
    // For now, the mathematical calculation above should be sufficient
  }
  
  return segmentNumber;
}

/**
 * Fallback mathematical calculation for segment detection
 */
function getSegmentUnderArrowMath(rotation) {
  const normalizedRotation = rotation % 360;
  if (normalizedRotation < 0) normalizedRotation += 360;
  
  const arrowAngleInOriginal = (270 - normalizedRotation + 360) % 360;
  let diff = (arrowAngleInOriginal - 279 + 360) % 360;
  let segmentIndex = Math.round(diff / 18);
  segmentIndex = segmentIndex % 20;
  if (segmentIndex < 0) segmentIndex += 20;
  return segmentIndex + 1;
}

function renderBronzeChat() {
  const container = document.getElementById('bronzeChatMessages');
  const input = document.getElementById('bronzeChatInput');
  const sendBtn = document.getElementById('bronzeChatSend');
  if (!container || !input || !sendBtn) return;

  const player = getBronzePlayer();
  const messages = appState.bronzeLobbyChat || [];
  if (!player) {
    container.innerHTML = '<div class="bronze-chat-empty">Join the lobby to chat.</div>';
  } else if (messages.length === 0) {
    container.innerHTML = '<div class="bronze-chat-empty">No messages yet. Say hello!</div>';
  } else {
    container.innerHTML = messages.map(msg => `
      <div class="bronze-chat-row ${msg.isYou ? 'is-you' : ''}">
        <div class="bronze-chat-name">${escapeHtml(msg.displayName || 'Anonymous')}</div>
        <div class="bronze-chat-text">${escapeHtml(msg.message)}</div>
        <div class="bronze-chat-time">${formatTimeAgo(msg.createdAt)}</div>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }

  input.disabled = !player;
  sendBtn.disabled = !player;
}

async function loadHistoryScreen(force = false) {
  if (!appState.currentUser) {
    showScreen('login');
    return;
  }

  if (!force && appState.gameHistory?.length) {
    renderHistoryList();
    renderHistoryDetail(appState.gameHistoryDetail);
    return;
  }

  setHistoryLoading(true);
  try {
    const res = await fetch(`${API_BASE}/api/history`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to load history');
    }
    appState.gameHistory = data.histories || [];
    renderHistoryList();
    if (appState.gameHistory.length > 0) {
      await selectHistoryGame(appState.gameHistory[0].gameNumber);
    } else {
      appState.gameHistoryDetail = null;
      renderHistoryDetail(null);
    }
  } catch (error) {
    console.error('History load error:', error);
    const list = document.getElementById('historyList');
    if (list) {
      list.innerHTML = `<div class="history-card">Unable to load history. ${error.message}</div>`;
    }
  } finally {
    setHistoryLoading(false);
  }
}

function setHistoryLoading(isLoading) {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (isLoading) {
    list.innerHTML = '<div class="history-card">Loading history...</div>';
  }
}

function renderHistoryList() {
  const list = document.getElementById('historyList');
  if (!list) return;

  if (!appState.gameHistory || appState.gameHistory.length === 0) {
    list.innerHTML = '<div class="history-card">No games recorded yet.</div>';
    return;
  }

  list.innerHTML = appState.gameHistory
    .map((history) => {
      const isActive = appState.gameHistorySelected === history.gameNumber;
      const dateStr = history.resolvedAt ? formatDateTime(history.resolvedAt) : 'Pending';
      return `
        <div class="history-card ${isActive ? 'active' : ''}" data-game="${history.gameNumber}">
          <div>
            <div class="history-card-title">#${formatGameNumber(history.gameNumber)} • ${history.tier}</div>
            <div class="history-card-meta">${dateStr}</div>
          </div>
          <div class="history-card-meta">
            Players ${history.playerCount}
            <br>
            Result ${history.winningNumber ?? '??'}
          </div>
        </div>
      `;
    })
    .join('');
}

async function selectHistoryGame(gameNumber) {
  if (!gameNumber) return;
  appState.gameHistorySelected = gameNumber;
  renderHistoryList();
  try {
    const res = await fetch(`${API_BASE}/api/history/${gameNumber}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to load history detail');
    }
    appState.gameHistoryDetail = data.history;
    renderHistoryDetail(appState.gameHistoryDetail);
  } catch (error) {
    console.error('History detail error:', error);
  }
}

function renderHistoryDetail(history) {
  const detail = document.getElementById('historyDetail');
  if (!detail) return;

  if (!history) {
    detail.innerHTML = `
      <div class="history-empty-state">
        <h3>Select a game</h3>
        <p>Choose a completed lobby to see full spin data.</p>
      </div>
    `;
    return;
  }

  const infoCards = [
    { label: 'Tier', value: history.tier },
    { label: 'Status', value: history.status },
  ];

  const spinStats = [
    { label: 'Spin Base', value: history.spinForceBase },
    { label: 'Spin Total', value: history.spinForceTotal },
    { label: 'Spin Final', value: history.spinForceFinal },
    { label: 'Winning #', value: history.winningNumber ?? '??' },
  ];

  const timestamps = [
    { label: 'Countdown Start', value: history.countdownStartedAt ? formatDateTime(history.countdownStartedAt) : '—' },
    { label: 'Spin Start', value: history.gameStartedAt ? formatDateTime(history.gameStartedAt) : '—' },
    { label: 'Resolved', value: history.resolvedAt ? formatDateTime(history.resolvedAt) : '—' },
  ];

  detail.innerHTML = `
    <div class="history-detail-header">
      <h3>Game #${formatGameNumber(history.gameNumber)}</h3>
      <p>Lobby ${history.lobbyId || 'N/A'} • Seed ${history.seed ? history.seed.slice(0, 10) + '…' : '—'}</p>
    </div>
    <div class="history-info-grid">
      ${infoCards
        .map(
          (card) => `
            <div class="history-info-card">
              <label>${card.label}</label>
              <strong>${card.value ?? '—'}</strong>
            </div>
          `
        )
        .join('')}
    </div>
    <div class="history-spin-stats-section">
      <button type="button" class="history-spin-stats-toggle" data-game="${history.gameNumber}">
        <span>Spin Stats</span>
        <span class="history-spin-stats-arrow">▼</span>
      </button>
      <div class="history-spin-stats" id="history-spin-stats-${history.gameNumber}" style="display: none;">
        ${spinStats
          .map(
            (stat) => `
              <div class="history-spin-stat-row">
                <label>${stat.label}</label>
                <strong>${stat.value ?? '—'}</strong>
              </div>
            `
          )
          .join('')}
      </div>
    </div>
    <div class="history-timestamps-section">
      <button type="button" class="history-timestamps-toggle" data-game="${history.gameNumber}">
        <span>Timestamps</span>
        <span class="history-timestamps-arrow">▼</span>
      </button>
      <div class="history-timestamps" id="history-timestamps-${history.gameNumber}" style="display: none;">
        ${timestamps
          .map(
            (ts) => `
              <div class="history-timestamp-row">
                <label>${ts.label}</label>
                <strong>${ts.value ?? '—'}</strong>
              </div>
            `
          )
          .join('')}
      </div>
    </div>
    <div class="history-players-section">
      <button type="button" class="history-players-toggle" data-game="${history.gameNumber}">
        <span>Players</span>
        <span class="history-players-arrow">▼</span>
      </button>
      <div class="history-players" id="history-players-${history.gameNumber}" style="display: none;">
        ${(history.players || [])
          .map(
            (player) => `
              <div class="history-player-row ${player.isWinner ? 'winner' : ''}">
                <div class="history-player-meta">
                  <div class="history-player-name">${escapeHtml(player.displayName || 'Anonymous')}</div>
                  <div class="history-player-sub">${player.email || 'Hidden'}</div>
                  <div class="history-player-sub">${player.joinedAt ? formatDateTime(player.joinedAt) : ''}</div>
                </div>
                <div class="history-player-number">
                  ${player.luckyNumber ?? '?'}
                  ${player.isWinner ? '<div class="winner-badge">Winner</div>' : ''}
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    </div>
  `;
}

function getTierPlayer(tier = null) {
  const currentTier = tier || appState.currentTier || 'BRONZE';
  const lobby = appState.currentTierLobby || (currentTier === 'BRONZE' ? appState.bronzeLobby : null);
  if (!lobby?.players) return null;
  return lobby.players.find(player => player.isYou);
}

function getBronzePlayer() {
  // Legacy function - use getTierPlayer for new code
  return getTierPlayer('BRONZE');
}

function handleBronzeNumberClick(event) {
  const button = event.target.closest('.bronze-number-btn');
  if (!button) return;
  if (button.disabled) return;
  const value = parseInt(button.dataset.number, 10);
  if (!Number.isInteger(value)) return;
  const currentTier = appState.currentTier || 'BRONZE';
  appState.tierSelectedNumber = value;
  if (currentTier === 'BRONZE') {
  appState.bronzeSelectedNumber = value;
  }
  renderBronzePicker();
}

async function handleBronzeJoin() {
  if (!appState.currentUser) {
    showScreen('login');
    return;
  }
  const currentTier = appState.currentTier || 'BRONZE';
  const lobby = appState.currentTierLobby || appState.bronzeLobby;
  if (!lobby) {
    setBronzeError('Lobby not ready yet. Please wait a moment.');
    return;
  }
  const selected = appState.tierSelectedNumber || appState.bronzeSelectedNumber;
  if (selected == null) {
    setBronzeError('Pick a lucky number first.');
    return;
  }
  const player = getTierPlayer(currentTier);
  const button = document.getElementById('bronzeJoinButton');
  if (!button) return;

  clearBronzeError();
  button.disabled = true;
  button.textContent = player ? 'Updating...' : 'Joining...';

  try {
    const endpoint = player && lobby.status === 'WAITING'
      ? `${API_BASE}/api/lobbies/${encodeURIComponent(lobby.id)}/choose-number`
      : `${API_BASE}/api/lobbies/${currentTier}/join`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ luckyNumber: selected }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to update lobby');
    }
    appState.currentTierLobby = data.lobby;
    if (currentTier === 'BRONZE') {
    appState.bronzeLobby = data.lobby;
    }
    const me = getTierPlayer(currentTier);
    if (me?.luckyNumber) {
      appState.tierSelectedNumber = me.luckyNumber;
      if (currentTier === 'BRONZE') {
      appState.bronzeSelectedNumber = me.luckyNumber;
    }
    }
    renderTierLobby(currentTier);
  } catch (error) {
    console.error(`${currentTier} join error:`, error);
    setBronzeError(error.message || 'Failed to join lobby');
  } finally {
    button.disabled = false;
    renderBronzePicker();
  }
}

async function handleBronzeChatSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('bronzeChatInput');
  if (!input || input.disabled) return;
  const message = input.value.trim();
  if (!message) return;
  if (!appState.bronzeLobby?.id) return;

  const sendBtn = document.getElementById('bronzeChatSend');
  sendBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/lobbies/${lobby.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to send message');
    }
    input.value = '';
    await fetchBronzeLobbyChat();
  } catch (error) {
    console.error('Bronze chat error:', error);
    alert(error.message || 'Failed to send message');
  } finally {
    sendBtn.disabled = false;
  }
}

function setBronzeError(message) {
  const errorEl = document.getElementById('bronzeLuckyError');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function clearBronzeError() {
  const errorEl = document.getElementById('bronzeLuckyError');
  if (errorEl) {
    errorEl.style.display = 'none';
  }
}

function setBronzeStatusMessage(message) {
  const statusEl = document.getElementById('bronzeLobbyStatus');
  if (statusEl) {
    statusEl.textContent = message;
  }
}

/**
 * Handle sign out
 */
async function handleSignOut() {
  if (!confirm('Are you sure you want to sign out?')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Logout request failed');
    }

    const data = await res.json();
    
    if (data.ok) {
      // Clear user state
      appState.currentUser = null;
      appState.wallet = null;
      appState.freeAttemptsStatus = null;
      
      // Force a hard reload to clear all state and ensure clean logout
      // Do this BEFORE calling setUser to avoid null reference errors
      window.location.href = '/';
      return; // Exit immediately, don't continue execution
    } else {
      throw new Error(data.error || 'Logout failed');
    }
  } catch (error) {
    console.error('Sign out error:', error);
    alert('Failed to sign out. Please try again.');
  }
}

/**
 * Show a specific screen
 */
function showScreen(screenName) {
  appState.currentScreen = screenName;
  if (screenName !== 'bronzeLobby') {
    stopBronzeLobbyLoop();
  }
  
  // Hide all screens
  Object.values(screens).forEach(el => {
    if (el) {
      el.style.display = 'none';
      el.classList.remove('active');
    }
  });
  
  // Show the selected screen
  if (screenName === 'login' && screens.login) {
    screens.login.style.display = 'block';
    // Re-initialize Google Sign-In button when showing login screen
    if (typeof google !== 'undefined' && google.accounts) {
      const buttonContainer = document.getElementById('googleSignInButton');
      if (buttonContainer && buttonContainer.children.length === 0) {
        initializeGoogleSignIn();
      }
    }
  } else if (screenName === 'lobby' && screens.lobby) {
    screens.lobby.style.display = 'block';
    loadLobbyContent(); // Load wallet summary and render tier buttons
  } else if (screenName === 'bronzeLobby' && screens.bronzeLobby) {
    screens.bronzeLobby.style.display = 'block';
    // Load wallet and start lobby polling
    if (!appState.wallet) {
      loadWalletSummary().then(() => {
        updateBronzeTicketBalance();
      });
    } else {
      updateBronzeTicketBalance();
    }
    startBronzeLobbyLoop();
  } else if (screenName === 'profile' && screens.profile) {
    screens.profile.style.display = 'block';
    screens.profile.classList.add('active');
  } else if (screenName === 'tickets' && screens.tickets) {
    screens.tickets.style.display = 'block';
    screens.tickets.classList.add('active');
  } else if (screenName === 'prizes' && screens.prizes) {
    screens.prizes.style.display = 'block';
    screens.prizes.classList.add('active');
  } else if (screenName === 'redemption' && screens.redemption) {
    screens.redemption.style.display = 'block';
    screens.redemption.classList.add('active');
  } else if (screenName === 'history' && screens.history) {
    screens.history.style.display = 'block';
  }
  
  // Show/hide bottom nav based on screen
  const bottomNav = document.querySelector('.bottom-nav');
  if (screenName === 'login' || screenName === 'bronzeLobby') {
    if (bottomNav) bottomNav.style.display = 'none';
  } else {
    if (bottomNav) bottomNav.style.display = 'flex';
  }
}

/**
 * Render prizes/economy breakdown page
 */
async function renderPrizesBreakdown() {
  const container = document.getElementById('prizesTiers');
  if (!container) return;

  // Load wallet if not already loaded
  if (!appState.wallet && appState.currentUser) {
    await loadWallet();
  }

  // Economy data (matching config/economy.js)
  // Note: BRONZE, SILVER, and GOLD are excluded as amounts are too small to cash out
  const economyData = [
    {
      tier: 'EMERALD',
      tierNum: 4,
      name: 'Emerald',
      color: '#50C878',
      bronzeEquivalent: 8000,
      adBackedValueUsd: 40.00,
      inheritedValueUsd: 30.00,
      pricedAtUsd: 25.00,
      description: '1 Emerald = 20 Gold = 8,000 Bronze',
    },
    {
      tier: 'SAPPHIRE',
      tierNum: 5,
      name: 'Sapphire',
      color: '#0F52BA',
      bronzeEquivalent: 160000,
      adBackedValueUsd: 800.00,
      inheritedValueUsd: 500.00,
      pricedAtUsd: 420.00,
      description: '1 Sapphire = 20 Emerald = 160,000 Bronze',
    },
    {
      tier: 'RUBY',
      tierNum: 6,
      name: 'Ruby',
      color: '#E0115F',
      bronzeEquivalent: 3200000,
      adBackedValueUsd: 16000.00,
      inheritedValueUsd: 8400.00,
      pricedAtUsd: 7500.00,
      description: '1 Ruby = 20 Sapphire = 3,200,000 Bronze',
    },
    {
      tier: 'AMETHYST',
      tierNum: 7,
      name: 'Amethyst',
      color: '#9966CC',
      bronzeEquivalent: 64000000,
      adBackedValueUsd: 320000.00,
      inheritedValueUsd: 150000.00,
      pricedAtUsd: 100000.00,
      description: '1 Amethyst = 20 Ruby = 64,000,000 Bronze',
    },
    {
      tier: 'DIAMOND',
      tierNum: 8,
      name: 'Diamond',
      color: '#B9F2FF',
      bronzeEquivalent: 1280000000,
      adBackedValueUsd: 6400000.00,
      inheritedValueUsd: 2000000.00,
      pricedAtUsd: 1000000.00,
      description: '1 Diamond = 20 Amethyst = 1,280,000,000 Bronze',
    },
  ];

  container.innerHTML = '';

  economyData.forEach(data => {
    const tierCard = document.createElement('div');
    tierCard.className = 'prize-tier-card';
    tierCard.style.borderColor = data.color;

    // Format numbers with commas
    const formatNumber = (num) => {
      if (num >= 1000000) {
        return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
      }
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    // Format currency
    const formatCurrency = (num) => {
      if (num >= 1000) {
        return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      }
      return `$${num.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    };

    tierCard.innerHTML = `
      <div class="prize-tier-header" style="color: ${data.color}">
        <h3>Tier ${data.tierNum}: ${data.name}</h3>
        <p class="prize-tier-description">${data.description}</p>
      </div>
      <div class="prize-tier-values">
        <div class="prize-value-row">
          <span class="prize-value-label">You currently have:</span>
          <span class="prize-value-number prize-value-balance">${appState.wallet?.[data.tier] || 0} ${data.name} ticket${(appState.wallet?.[data.tier] || 0) !== 1 ? 's' : ''}!</span>
        </div>
        <div class="prize-value-row">
          <span class="prize-value-label">Official Price:</span>
          <span class="prize-value-number prize-value-official">${formatCurrency(data.pricedAtUsd)}</span>
          <span class="prize-value-explanation">(Internal valuation)</span>
        </div>
      </div>
      <div class="prize-tier-redeem">
        <div class="redeem-icons">
          <div class="crypto-icon-wrapper" title="Bitcoin">
            <svg class="crypto-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.243 15.533.358 9.105 1.96 2.67 8.472-1.243 14.9.358c6.43 1.605 10.342 8.117 8.738 14.546z" fill="#F7931A"/>
              <path d="M17.288 10.284c.255-1.708-.996-2.625-2.69-3.237l.55-2.204-1.345-.335-.536 2.147c-.353-.088-.715-.17-1.075-.252l.538-2.157-1.345-.335-.55 2.204c-.293-.067-.58-.133-.858-.197l.001-.007-1.852-.462-.357 1.432s.996.229.975.243c.544.136.642.495.625.779l-.625 2.506c.038.01.086.024.14.047l-.142-.035-.88 3.53c-.066.165-.233.41-.61.317.014.019-.975-.243-.975-.243l-.666 1.52 1.746.435c.325.081.643.166.953.245l-.562 2.255 1.344.335.55-2.205c.366.099.72.19 1.062.275l-.549 2.2 1.345.335.562-2.254c2.29.434 4.01.259 4.735-1.82.57-1.64-.028-2.586-1.204-3.205.857-.197 1.503-.76 1.675-1.92zm-3.007 4.22c-.405 1.625-3.157.748-4.047.528l.722-2.894c.89.222 3.74.662 3.325 2.366zm.402-4.24c-.37 1.483-2.656.73-3.4.546l.654-2.62c.744.185 3.14.525 2.746 2.074z" fill="#FFF"/>
            </svg>
          </div>
          <div class="crypto-icon-wrapper" title="Solana">
            <svg class="crypto-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.563 16.114a.696.696 0 0 1-.493-.205L.213 12.09a.696.696 0 0 1 0-.985l3.857-3.819a.696.696 0 0 1 .985 0l3.857 3.819a.696.696 0 0 1 0 .985l-3.857 3.819a.696.696 0 0 1-.492.205zm6.43 0a.696.696 0 0 1-.492-.205L6.643 12.09a.696.696 0 0 1 0-.985l3.858-3.819a.696.696 0 0 1 .985 0l3.857 3.819a.696.696 0 0 1 0 .985l-3.857 3.819a.696.696 0 0 1-.493.205zm6.43 0a.696.696 0 0 1-.493-.205L13.073 12.09a.696.696 0 0 1 0-.985l3.857-3.819a.696.696 0 0 1 .986 0l3.857 3.819a.696.696 0 0 1 0 .985l-3.857 3.819a.696.696 0 0 1-.493.205z" fill="#14F195"/>
            </svg>
          </div>
        </div>
        <button type="button" class="redeem-ticket-btn" data-tier="${data.tier}" data-tier-name="${data.name}">
          Redeem Ticket
        </button>
      </div>
    `;

    container.appendChild(tierCard);
  });

  // Attach click handlers to redeem buttons
  document.querySelectorAll('.redeem-ticket-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tier = btn.dataset.tier;
      const tierName = btn.dataset.tierName;
      showRedemptionScreen(tier, tierName);
    });
  });

  // Load pending withdrawals
  await loadPendingWithdrawals();
}

/**
 * Load and display pending withdrawal requests
 */
async function loadPendingWithdrawals() {
  if (!appState.currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/api/withdrawal/my-requests`, {
      credentials: 'include',
    });
    
    const data = await res.json();
    
    if (data.ok && data.requests) {
      appState.pendingRequests = data.requests;
      renderPendingWithdrawals(data.requests);
    }
  } catch (error) {
    console.error('Error loading pending withdrawals:', error);
  }
}

/**
 * Render pending withdrawal requests with crypto amounts
 */
async function renderPendingWithdrawals(requests) {
  const section = document.getElementById('pendingWithdrawalsSection');
  const container = document.getElementById('pendingWithdrawalsList');
  
  if (!section || !container) return;

  // Filter to show only pending/processing requests
  const pending = requests.filter(r => r.status === 'PENDING' || r.status === 'PROCESSING');
  
  if (pending.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = '';

  // Fetch crypto prices once for all requests
  const prices = await fetchCryptoPrices();

  const tierMetadata = {
    EMERALD: { name: 'Emerald', color: '#50C878' },
    SAPPHIRE: { name: 'Sapphire', color: '#0F52BA' },
    RUBY: { name: 'Ruby', color: '#E0115F' },
    AMETHYST: { name: 'Amethyst', color: '#9966CC' },
    DIAMOND: { name: 'Diamond', color: '#B9F2FF' },
  };

  pending.forEach(request => {
    const metadata = tierMetadata[request.tier] || { name: request.tier, color: '#FFFFFF' };
    const statusColors = {
      PENDING: '#FFAA00',
      PROCESSING: '#00AAFF',
      PAID: '#00FF00',
      REJECTED: '#FF0000',
      CANCELLED: '#888888',
    };

    // Calculate crypto amounts
    const ticketValueUsd = getTicketValueUsd(request.tier);
    let btcAmount = null;
    let solAmount = null;
    
    if (prices) {
      if (prices.btc) {
        btcAmount = ticketValueUsd / prices.btc;
      }
      if (prices.sol) {
        solAmount = ticketValueUsd / prices.sol;
      }
    }

    const requestCard = document.createElement('div');
    requestCard.className = 'pending-withdrawal-card';
    requestCard.style.borderColor = metadata.color;

    const date = new Date(request.createdAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    requestCard.innerHTML = `
      <div class="pending-withdrawal-header">
        <div class="pending-withdrawal-tier" style="color: ${metadata.color}">
          ${metadata.name} Ticket
        </div>
        <div class="pending-withdrawal-status" style="color: ${statusColors[request.status] || '#FFFFFF'}">
          ${request.status}
        </div>
      </div>
      <div class="pending-withdrawal-details">
        <div class="pending-withdrawal-detail-row">
          <span class="pending-withdrawal-label">Prize Value:</span>
          <span class="pending-withdrawal-value pending-withdrawal-usd">$${ticketValueUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </div>
        ${btcAmount !== null ? `
          <div class="pending-withdrawal-detail-row">
            <span class="pending-withdrawal-label">Bitcoin Amount:</span>
            <span class="pending-withdrawal-value pending-withdrawal-crypto">
              <span class="crypto-icon-small">₿</span>
              ${formatCryptoAmount(btcAmount)} BTC
            </span>
          </div>
        ` : ''}
        ${solAmount !== null ? `
          <div class="pending-withdrawal-detail-row">
            <span class="pending-withdrawal-label">Solana Amount:</span>
            <span class="pending-withdrawal-value pending-withdrawal-crypto">
              <span class="crypto-icon-small">◎</span>
              ${formatCryptoAmount(solAmount)} SOL
            </span>
          </div>
        ` : ''}
        <div class="pending-withdrawal-detail-row">
          <span class="pending-withdrawal-label">Requested:</span>
          <span class="pending-withdrawal-value">${dateStr}</span>
        </div>
        ${request.btcAddress ? `
          <div class="pending-withdrawal-detail-row">
            <span class="pending-withdrawal-label">Bitcoin Address:</span>
            <span class="pending-withdrawal-value pending-withdrawal-address">${request.btcAddress.substring(0, 10)}...${request.btcAddress.substring(request.btcAddress.length - 8)}</span>
          </div>
        ` : ''}
        ${request.solAddress ? `
          <div class="pending-withdrawal-detail-row">
            <span class="pending-withdrawal-label">Solana Address:</span>
            <span class="pending-withdrawal-value pending-withdrawal-address">${request.solAddress.substring(0, 10)}...${request.solAddress.substring(request.solAddress.length - 8)}</span>
          </div>
        ` : ''}
        ${request.adminNotes ? `
          <div class="pending-withdrawal-detail-row">
            <span class="pending-withdrawal-label">Admin Notes:</span>
            <span class="pending-withdrawal-value">${request.adminNotes}</span>
          </div>
        ` : ''}
      </div>
    `;

    container.appendChild(requestCard);
  });
}

/**
 * Show redemption screen for a specific tier
 */
async function showRedemptionScreen(tier, tierName) {
  if (!appState.currentUser) {
    showScreen('login');
    return;
  }

  // Store redemption context
  appState.redemptionTier = tier;
  appState.redemptionTierName = tierName;

  // Load wallet for display
  await loadWallet();
  renderRedemptionWallet();
  await renderRedemptionTicketType(tier, tierName);

  // Show redemption screen
  showScreen('redemption');

  // Update bottom nav (hide it for redemption screen)
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) bottomNav.style.display = 'none';
}

/**
 * Render wallet grid in redemption screen
 */
function renderRedemptionWallet() {
  const container = document.getElementById('redemptionWalletGrid');
  if (!container || !appState.wallet) return;

  const tierMetadata = {
    BRONZE: { name: 'Bronze', color: '#CD7F32' },
    SILVER: { name: 'Silver', color: '#C0C0C0' },
    GOLD: { name: 'Gold', color: '#FFD700' },
    EMERALD: { name: 'Emerald', color: '#50C878' },
    SAPPHIRE: { name: 'Sapphire', color: '#0F52BA' },
    RUBY: { name: 'Ruby', color: '#E0115F' },
    AMETHYST: { name: 'Amethyst', color: '#9966CC' },
    DIAMOND: { name: 'Diamond', color: '#B9F2FF' },
  };

  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'DIAMOND'];

  container.innerHTML = '';

  tiers.forEach(tier => {
    const metadata = tierMetadata[tier];
    const balance = appState.wallet[tier] || 0;

    const card = document.createElement('div');
    card.className = 'redemption-wallet-card';
    if (tier === appState.redemptionTier) {
      card.classList.add('redemption-wallet-card-selected');
    }
    card.style.borderColor = metadata.color;

    card.innerHTML = `
      <div class="redemption-wallet-tier-name" style="color: ${metadata.color}">${metadata.name}</div>
      <div class="redemption-wallet-tier-balance">${balance}</div>
    `;

    container.appendChild(card);
  });
}

/**
 * Render the ticket type being redeemed with crypto price calculations
 */
async function renderRedemptionTicketType(tier, tierName) {
  const container = document.getElementById('redemptionTicketDisplay');
  if (!container) return;

  const tierMetadata = {
    BRONZE: { name: 'Bronze', color: '#CD7F32' },
    SILVER: { name: 'Silver', color: '#C0C0C0' },
    GOLD: { name: 'Gold', color: '#FFD700' },
    EMERALD: { name: 'Emerald', color: '#50C878' },
    SAPPHIRE: { name: 'Sapphire', color: '#0F52BA' },
    RUBY: { name: 'Ruby', color: '#E0115F' },
    AMETHYST: { name: 'Amethyst', color: '#9966CC' },
    DIAMOND: { name: 'Diamond', color: '#B9F2FF' },
  };

  const metadata = tierMetadata[tier] || { name: tierName, color: '#FFFFFF' };
  const balance = appState.wallet?.[tier] || 0;

  // Get ticket value from economy config
  const ticketValueUsd = getTicketValueUsd(tier);
  
  // Fetch crypto prices
  let btcPrice = null;
  let solPrice = null;
  let btcAmount = null;
  let solAmount = null;

  try {
    const prices = await fetchCryptoPrices();
    if (prices) {
      btcPrice = prices.btc;
      solPrice = prices.sol;
      
      // Calculate crypto amounts
      if (btcPrice) {
        btcAmount = ticketValueUsd / btcPrice;
      }
      if (solPrice) {
        solAmount = ticketValueUsd / solPrice;
      }
    }
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
  }

  container.innerHTML = `
    <div class="redemption-ticket-card" style="border-color: ${metadata.color}">
      <div class="redemption-ticket-name" style="color: ${metadata.color}">${metadata.name}</div>
      <div class="redemption-ticket-balance">Available: ${balance}</div>
      <div class="redemption-ticket-value">
        <div class="redemption-value-usd">Prize Value: $${ticketValueUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
        ${btcAmount !== null ? `
          <div class="redemption-value-crypto">
            <span class="crypto-icon-small">₿</span>
            <span class="crypto-amount">${formatCryptoAmount(btcAmount)} BTC</span>
            <span class="crypto-price">@ $${btcPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          </div>
        ` : ''}
        ${solAmount !== null ? `
          <div class="redemption-value-crypto">
            <span class="crypto-icon-small">◎</span>
            <span class="crypto-amount">${formatCryptoAmount(solAmount)} SOL</span>
            <span class="crypto-price">@ $${solPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          </div>
        ` : ''}
        ${btcAmount === null && solAmount === null ? `
          <div class="redemption-value-loading">Loading crypto prices...</div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Get ticket value in USD from economy config
 */
function getTicketValueUsd(tier) {
  // Economy values (matching config/economy.js)
  const tierValues = {
    EMERALD: 25.00,
    SAPPHIRE: 420.00,
    RUBY: 7500.00,
    AMETHYST: 100000.00,
    DIAMOND: 1000000.00,
  };
  return tierValues[tier] || 0;
}

/**
 * Fetch current Bitcoin and Solana prices from CoinGecko API
 */
async function fetchCryptoPrices() {
  try {
    // CoinGecko free API - no key required
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana&vs_currencies=usd', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch crypto prices');
    }

    const data = await response.json();
    
    return {
      btc: data.bitcoin?.usd || null,
      sol: data.solana?.usd || null,
    };
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return null;
  }
}

/**
 * Format crypto amount with appropriate decimal places
 */
function formatCryptoAmount(amount) {
  if (amount >= 1) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 2 });
  } else if (amount >= 0.01) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 2 });
  } else {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 8, minimumFractionDigits: 2 });
  }
}

/**
 * Handle redemption form submission
 */
async function handleRedemptionSubmit() {
  if (!appState.currentUser || !appState.redemptionTier) {
    alert('Please select a ticket tier to redeem');
    return;
  }

  const btcAddress = document.getElementById('btcAddressInput')?.value.trim();
  const solAddress = document.getElementById('solAddressInput')?.value.trim();

  if (!btcAddress && !solAddress) {
    alert('Please enter at least one wallet address (Bitcoin or Solana)');
    return;
  }

  // Validate addresses (basic check)
  if (btcAddress && !btcAddress.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/)) {
    if (!confirm('The Bitcoin address format looks incorrect. Continue anyway?')) {
      return;
    }
  }

  if (solAddress && !solAddress.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
    if (!confirm('The Solana address format looks incorrect. Continue anyway?')) {
      return;
    }
  }

  // Check if user has the ticket
  const balance = appState.wallet?.[appState.redemptionTier] || 0;
  if (balance < 1) {
    alert(`You don't have any ${appState.redemptionTierName} tickets to redeem`);
    return;
  }

  // TODO: Implement actual redemption API call
  // For now, just show a confirmation
  const confirmMsg = `Submit redemption request for 1 ${appState.redemptionTierName} ticket?\n\n` +
    (btcAddress ? `Bitcoin: ${btcAddress.substring(0, 10)}...\n` : '') +
    (solAddress ? `Solana: ${solAddress.substring(0, 10)}...\n` : '');

  if (!confirm(confirmMsg)) {
    return;
  }

  // Disable button
  const submitBtn = document.getElementById('redemptionSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
  }

  // Submit withdrawal request to API
  try {
    const res = await fetch(`${API_BASE}/api/withdrawal/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        tier: appState.redemptionTier,
        btcAddress: btcAddress || null,
        solAddress: solAddress || null,
      }),
    });
    
    const data = await res.json();
    
    if (data.ok) {
      alert('Withdrawal request submitted successfully!');
      
      // Refresh wallet (ticket was consumed)
      await loadWallet();
      
      // Refresh pending requests on prizes page
      if (appState.pendingRequests) {
        await loadPendingWithdrawals();
      }
      
      // Go back to prizes
      showScreen('prizes');
      const bottomNav = document.querySelector('.bottom-nav');
      if (bottomNav) bottomNav.style.display = 'flex';
    } else {
      throw new Error(data.error || 'Withdrawal request failed');
    }
  } catch (error) {
    console.error('Withdrawal request error:', error);
    alert('Failed to submit withdrawal request: ' + error.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Redemption Request';
    }
  }
}

/**
 * DEPRECATED: Load games from the API (tombola system)
 * TODO: Remove after full migration to tier queue system
 * Currently disabled - lobby no longer shows tombola cards
 */
async function loadTombolas() {
  // Disabled for now - lobby screen redesigned
  // Keep function for potential future use
  return;
  
  /* Original code preserved for reference:
  try {
    const response = await fetch(`${API_BASE}/api/tombolas`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to load games');
    }
    
    const tombolas = await response.json();
    appState.tombolas = tombolas;
    renderLobby(tombolas);
    startCountdowns();
  } catch (error) {
    console.error('Error loading tombolas:', error);
    const grid = document.getElementById('tombolaGrid');
    if (grid) {
      grid.innerHTML = '<div class="error-message">Failed to load games. Please refresh the page.</div>';
    }
  }
  */
}

/**
 * DEPRECATED: Render the lobby with game cards (tombola system)
 * TODO: Remove after full migration to tier queue system
 */
function renderLobby(tombolas) {
  // Disabled - lobby screen redesigned
  return;
}

/**
 * Create HTML for a game card
 */
function createTombolaCard(tombola) {
  const statusClass = tombola.status.toLowerCase();
  const timeDisplay = formatTime(tombola.timeLeftSeconds);
  
  return `
    <div class="tombola-card" data-id="${tombola.id}">
      <div class="tombola-header">
        <div class="tombola-name">${escapeHtml(tombola.name)}</div>
        <span class="status-pill ${statusClass}">${tombola.status}</span>
      </div>
      <div class="tombola-prize">${escapeHtml(tombola.prize)}</div>
      <div class="tombola-info">
        <span class="time-left" data-tombola-id="${tombola.id}">${timeDisplay}</span>
        <span class="ticket-count">${tombola.totalTickets} public tickets</span>
      </div>
      <a href="#" class="view-link" onclick="event.preventDefault(); return false;">View details ›</a>
    </div>
  `;
}

/**
 * Format time in seconds to readable format
 */
function formatTime(seconds) {
  if (seconds <= 0) {
    return 'Finished';
  }
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Start countdown timers for all LIVE and PENDING tombolas
 */
function startCountdowns() {
  // Clear existing intervals
  appState.countdownIntervals.forEach(interval => clearInterval(interval));
  appState.countdownIntervals.clear();
  
  appState.tombolas.forEach(tombola => {
    if (tombola.status === 'LIVE' || tombola.status === 'PENDING') {
      const element = document.querySelector(`[data-tombola-id="${tombola.id}"]`);
      if (!element) return;
      
      let timeLeft = tombola.timeLeftSeconds;
      
      const interval = setInterval(() => {
        timeLeft--;
        
        if (timeLeft <= 0) {
          clearInterval(interval);
          element.textContent = 'Finished';
          // TODO: Update tombola status to FINISHED
        } else {
          element.textContent = formatTime(timeLeft);
        }
      }, 1000);
      
      appState.countdownIntervals.set(tombola.id, interval);
    }
  });
}

/**
 * Show tombola details in a modal
 */
async function showTombolaDetails(tombola) {
  try {
    // Fetch full details from API
    const response = await fetch(`${API_BASE}/api/tombolas/${tombola.id}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to load tombola details');
    }
    
    const details = await response.json();
    
    // Set active tombola
    appState.activeTombolaId = tombola.id;
    
    // Update modal
    document.getElementById('modalTombolaName').textContent = details.name;
    
    // Populate overview panel
    populateOverviewPanel(details);
    
    // Switch to overview tab
    switchModalTab('overview');
    
    // Update enter button state
    updateEnterButtonState();
    
    // Load ticket board data (but don't show until tab is clicked)
    await loadTicketBoard(tombola.id);
    
    // Show modal
    document.getElementById('tombolaModal').style.display = 'flex';
  } catch (error) {
    console.error('Error loading tombola details:', error);
    alert('Failed to load tombola details');
  }
}

/**
 * Populate the overview panel with tombola details
 */
function populateOverviewPanel(details) {
  const overviewPanel = document.getElementById('modal-panel-overview');
  overviewPanel.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <strong>Prize:</strong> ${escapeHtml(details.prize)}
    </div>
    <div style="margin-bottom: 1rem;">
      <strong>Status:</strong> <span class="status-pill ${details.status.toLowerCase()}">${details.status}</span>
    </div>
    <div style="margin-bottom: 1rem;">
      <strong>Time Remaining:</strong> ${formatTime(details.timeLeftSeconds)}
    </div>
    <div style="margin-bottom: 1rem;">
      <strong>Total Tickets:</strong> <span id="overview-total-tickets">${details.totalTickets}</span>
    </div>
    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="color: var(--text-secondary); font-size: 0.9rem;">
        Click the "Ticket Board" tab to view all entries and enter the draw.
      </p>
    </div>
  `;
}

/**
 * Switch modal tab
 */
function switchModalTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });
  
  // Update panels
  document.querySelectorAll('.modal-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  if (tabName === 'overview') {
    document.getElementById('modal-panel-overview').classList.add('active');
  } else if (tabName === 'board') {
    document.getElementById('modal-panel-board').classList.add('active');
    // Reload board when switching to board tab
    if (appState.activeTombolaId) {
      loadTicketBoard(appState.activeTombolaId);
    }
  } else if (tabName === 'game') {
    document.getElementById('modal-panel-game').classList.add('active');
    // Load game scoreboard when switching to game tab
    if (appState.activeTombolaId) {
      loadGameScoreboard(appState.activeTombolaId);
    }
  }
}

/**
 * Load ticket board for a tombola
 */
async function loadTicketBoard(tombolaId) {
  const boardList = document.getElementById('board-list');
  const boardEmpty = document.getElementById('board-empty');
  
  if (!boardList || !boardEmpty) return;
  
  // Show loading state
  boardList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Loading...</div>';
  boardEmpty.style.display = 'none';
  
  try {
    const response = await fetch(`${API_BASE}/api/tombolas/${encodeURIComponent(tombolaId)}/board`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to load ticket board');
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Failed to load board');
    }
    
    // Update your ticket count
    const yourCountEl = document.getElementById('board-your-count');
    if (yourCountEl) {
      yourCountEl.textContent = data.yourTicketCount || 0;
    }
    
    // Update overview total tickets
    const overviewTotal = document.getElementById('overview-total-tickets');
    if (overviewTotal) {
      overviewTotal.textContent = data.totalTickets || 0;
    }
    
    // Update enter button state
    updateEnterButtonState();
    
    // Render tickets
    if (!data.tickets || data.tickets.length === 0) {
      boardList.innerHTML = '';
      boardEmpty.style.display = 'block';
    } else {
      boardEmpty.style.display = 'none';
      boardList.innerHTML = data.tickets.map(ticket => createBoardRow(ticket)).join('');
    }
  } catch (error) {
    console.error('Error loading ticket board:', error);
    boardList.innerHTML = '<div style="padding: 2rem; text-align: center; color: #ff4444;">Failed to load ticket board. Please try again.</div>';
  }
}

/**
 * Create HTML for a board row
 */
function createBoardRow(ticket) {
  const ticketId = ticket.ticketId.includes('-') ? ticket.ticketId.split('-')[1] : ticket.ticketId;
  const timeAgo = formatTimeAgo(ticket.createdAt);
  const youClass = ticket.isYou ? ' you' : '';
  
  return `
    <div class="board-row${youClass}">
      <div class="board-ticket-id">#${ticketId}</div>
      <div class="board-player">
        ${escapeHtml(ticket.publicName)}
        ${ticket.isYou ? '<span class="board-you-tag">YOU</span>' : ''}
      </div>
      <div class="board-time">${timeAgo}</div>
    </div>
  `;
}

/**
 * Format time ago from ISO timestamp
 */
function formatTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // Show date if older
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatGameNumber(gameNumber) {
  if (!gameNumber && gameNumber !== 0) return '000000000';
  const value = typeof gameNumber === 'string' ? gameNumber : gameNumber.toString();
  return value.padStart(9, '0');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Update enter button state based on user credits
 */
function updateEnterButtonState() {
  const enterBtn = document.getElementById('board-enter-btn');
  const hintEl = document.getElementById('board-enter-hint');
  
  if (!enterBtn || !hintEl) return;
  
  if (!appState.currentUser) {
    enterBtn.disabled = true;
    hintEl.textContent = 'Please sign in to enter draws.';
    return;
  }
  
  const credits = appState.currentUser.credits != null ? appState.currentUser.credits : 0;
  
  if (credits < 1) {
    enterBtn.disabled = true;
    hintEl.textContent = 'You have no tickets. Earn more from My Tickets.';
  } else {
    enterBtn.disabled = false;
    hintEl.textContent = 'Uses 1 ticket from your balance. Tickets cannot be bought.';
  }
}

/**
 * Handle enter draw button click
 */
async function handleEnterDraw() {
  if (!appState.activeTombolaId) {
    alert('No game selected');
    return;
  }
  
  if (!appState.currentUser) {
    alert('Please sign in first');
    return;
  }
  
  const credits = appState.currentUser.credits != null ? appState.currentUser.credits : 0;
  if (credits < 1) {
    alert('You have no tickets. Go to My Tickets to earn more.');
    return;
  }
  
  const enterBtn = document.getElementById('board-enter-btn');
  if (!enterBtn || enterBtn.disabled) return;
  
  // Disable button
  enterBtn.disabled = true;
  enterBtn.textContent = 'Entering...';
  
  try {
    const response = await fetch(`${API_BASE}/api/tombolas/${encodeURIComponent(appState.activeTombolaId)}/enter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ count: 1 }),
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      if (data.error === 'Not enough tickets') {
        alert('You don\'t have enough tickets. Go to My Tickets to earn more.');
      } else {
        throw new Error(data.error || 'Failed to enter draw');
      }
      return;
    }
    
    // Update user credits
    appState.currentUser.credits = data.newBalance;
    if (data.user) {
      appState.currentUser = { ...appState.currentUser, ...data.user };
    }
    
    // Update all balance displays
    updateTicketsBalanceUI();
    
    // Update board
    const boardList = document.getElementById('board-list');
    const boardEmpty = document.getElementById('board-empty');
    
    if (boardList && boardEmpty) {
      boardEmpty.style.display = 'none';
      
      // Prepend new ticket to the top
      const newRow = createBoardRow(data.ticket);
      boardList.insertAdjacentHTML('afterbegin', newRow);
      
      // Update counts
      const yourCountEl = document.getElementById('board-your-count');
      if (yourCountEl) {
        yourCountEl.textContent = data.yourTicketCount || 0;
      }
      
      const overviewTotal = document.getElementById('overview-total-tickets');
      if (overviewTotal) {
        overviewTotal.textContent = data.totalTickets || 0;
      }
    }
    
    // Show success message
    alert(`You entered the draw! Ticket ID: ${data.ticket.ticketId}`);
    
    // Update button state
    updateEnterButtonState();
    
  } catch (error) {
    console.error('Enter draw error:', error);
    alert('Something went wrong. Please try again.');
    updateEnterButtonState();
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load game scoreboard for a tombola
 */
async function loadGameScoreboard(tombolaId) {
  const scoreboard = document.getElementById('game-scoreboard');
  if (!scoreboard) return;
  
  // Reset game state
  resetGameState();
  
  try {
    const response = await fetch(`${API_BASE}/api/tombolas/${encodeURIComponent(tombolaId)}/board`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to load scoreboard');
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Failed to load scoreboard');
    }
    
    // Board endpoint returns newest first, but game needs oldest first (purchase order)
    // Reverse to get purchase order
    const tickets = data.tickets || [];
    appState.activeTombolaTickets = [...tickets].reverse();
    
    // Render scoreboard
    renderGameScoreboard(appState.activeTombolaTickets);
    
    // Update start button state
    updateGameStartButton();
    
  } catch (error) {
    console.error('Error loading game scoreboard:', error);
    scoreboard.innerHTML = '<div style="padding: 2rem; text-align: center; color: #ff4444;">Failed to load scoreboard. Please try again.</div>';
  }
}

/**
 * Render game scoreboard
 */
function renderGameScoreboard(tickets) {
  const scoreboard = document.getElementById('game-scoreboard');
  if (!scoreboard) return;
  
  if (!tickets || tickets.length === 0) {
    scoreboard.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--muted);">No tickets yet. Enter the draw first!</div>';
    return;
  }
  
  scoreboard.innerHTML = tickets.map(ticket => createGameTicketRow(ticket)).join('');
}

/**
 * Create HTML for a game ticket row
 */
function createGameTicketRow(ticket) {
  const ticketId = ticket.ticketId.includes('-') ? ticket.ticketId.split('-')[1] : ticket.ticketId;
  const youClass = ticket.isYou ? ' you' : '';
  
  return `
    <div class="game-ticket-row${youClass}" data-ticket-id="${ticket.ticketId}">
      <div class="game-ticket-id">#${ticketId}</div>
      <div class="game-player-name">
        ${escapeHtml(ticket.publicName)}
        ${ticket.isYou ? '<span class="board-you-tag">YOU</span>' : ''}
      </div>
    </div>
  `;
}

/**
 * Update game start button state
 */
function updateGameStartButton() {
  const startBtn = document.getElementById('game-start-btn');
  if (!startBtn) return;
  
  if (!appState.currentUser) {
    startBtn.disabled = true;
    startBtn.textContent = 'Sign in to start draw';
    return;
  }
  
  if (appState.activeTombolaTickets.length < 1) {
    startBtn.disabled = true;
    startBtn.textContent = 'No tickets to draw';
    return;
  }
  
  // TODO: Check if draw is already finished
  // For now, allow any logged-in user to start
  startBtn.disabled = false;
  startBtn.textContent = 'Start draw';
}

/**
 * Reset game state
 */
function resetGameState() {
  // Clear timers
  if (appState.gameCountdownTimer) {
    clearInterval(appState.gameCountdownTimer);
    appState.gameCountdownTimer = null;
  }
  if (appState.gameSpinTimer) {
    clearTimeout(appState.gameSpinTimer);
    appState.gameSpinTimer = null;
  }
  
  appState.gameIsRunning = false;
  
  // Reset UI
  const countdownValue = document.getElementById('game-countdown-value');
  const countdownProgress = document.getElementById('countdown-progress');
  const resultBanner = document.getElementById('game-result-banner');
  const startBtn = document.getElementById('game-start-btn');
  
  if (countdownValue) countdownValue.textContent = '10';
  if (countdownProgress) {
    countdownProgress.style.strokeDashoffset = '283';
  }
  if (resultBanner) resultBanner.style.display = 'none';
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = 'Start draw';
  }
  
  // Remove highlight and winner classes
  document.querySelectorAll('.game-ticket-row').forEach(row => {
    row.classList.remove('highlight', 'winner');
  });
}

/**
 * Handle start draw button click
 */
function handleStartDraw() {
  if (appState.gameIsRunning) {
    return;
  }
  
  if (!appState.activeTombolaId) {
    alert('No tombola selected');
    return;
  }
  
  if (appState.activeTombolaTickets.length < 1) {
    alert('No tickets to draw. Enter the draw first!');
    return;
  }
  
  // Set running state
  appState.gameIsRunning = true;
  
  // Hide result banner
  const resultBanner = document.getElementById('game-result-banner');
  if (resultBanner) {
    resultBanner.style.display = 'none';
  }
  
  // Remove winner/highlight classes
  document.querySelectorAll('.game-ticket-row').forEach(row => {
    row.classList.remove('highlight', 'winner');
  });
  
  // Disable start button
  const startBtn = document.getElementById('game-start-btn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = 'Draw in progress...';
  }
  
  // Start countdown
  startCountdown();
}

/**
 * Start countdown timer
 */
function startCountdown() {
  let seconds = 10;
  const countdownValue = document.getElementById('game-countdown-value');
  const countdownProgress = document.getElementById('countdown-progress');
  const circumference = 283; // 2 * PI * 45
  
  function updateCountdown() {
    if (countdownValue) {
      countdownValue.textContent = seconds;
    }
    
    if (countdownProgress) {
      const progress = (10 - seconds) / 10;
      const offset = circumference - (progress * circumference);
      countdownProgress.style.strokeDashoffset = offset;
    }
    
    seconds--;
    
    if (seconds < 0) {
      clearInterval(appState.gameCountdownTimer);
      appState.gameCountdownTimer = null;
      triggerServerDraw();
    }
  }
  
  updateCountdown(); // Initial update
  appState.gameCountdownTimer = setInterval(updateCountdown, 1000);
}

/**
 * Trigger server draw
 */
async function triggerServerDraw() {
  try {
    const response = await fetch(`${API_BASE}/api/tombolas/${encodeURIComponent(appState.activeTombolaId)}/draw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      if (data.error === 'Draw already finished.') {
        alert('This draw has already finished.');
      } else if (data.error === 'No tickets to draw.') {
        alert('No tickets to draw.');
      } else {
        throw new Error(data.error || 'Failed to resolve draw');
      }
      
      appState.gameIsRunning = false;
      updateGameStartButton();
      return;
    }
    
    // Store winner info
    const winnerTicketId = data.winner.ticketId;
    const tickets = data.tickets; // Ordered oldest → newest
    const pot = data.pot;
    
    // Update user credits if winner is current user
    if (data.winner.isYou && data.winnerUserNewBalance !== undefined) {
      appState.currentUser.credits = data.winnerUserNewBalance;
      updateTicketsBalanceUI();
    }
    
    // Update tickets list
    appState.activeTombolaTickets = tickets;
    
    // Re-render scoreboard to match server order exactly
    renderGameScoreboard(tickets);
    
    // Start spin animation
    startSpinAnimation(tickets, winnerTicketId, pot, data.winner);
    
  } catch (error) {
    console.error('Draw error:', error);
    alert('Something went wrong. Please try again.');
    appState.gameIsRunning = false;
    updateGameStartButton();
  }
}

/**
 * Start spin animation towards winner
 */
function startSpinAnimation(tickets, winnerTicketId, pot, winnerInfo) {
  const rows = Array.from(document.querySelectorAll('.game-ticket-row'));
  
  if (rows.length === 0) {
    console.error('No ticket rows found for animation');
    return;
  }
  
  // Find winner index
  const winnerIndex = tickets.findIndex(t => t.ticketId === winnerTicketId);
  
  if (winnerIndex === -1) {
    console.error('Winner ticket not found in list');
    return;
  }
  
  let currentIndex = 0;
  let stepCount = 0;
  const totalPasses = 3; // Number of full passes
  const totalSteps = tickets.length * totalPasses + winnerIndex;
  let speed = 80; // Initial speed in ms
  
  function highlightStep() {
    // Clear previous highlight
    rows.forEach(r => r.classList.remove('highlight'));
    
    // Add highlight to current row
    if (rows[currentIndex]) {
      rows[currentIndex].classList.add('highlight');
    }
    
    // Check if we should stop
    if (stepCount >= totalSteps) {
      // Final: mark winner
      rows.forEach(r => r.classList.remove('highlight'));
      if (rows[winnerIndex]) {
        rows[winnerIndex].classList.add('winner');
        // Add winner badge
        const playerNameEl = rows[winnerIndex].querySelector('.game-player-name');
        if (playerNameEl && !playerNameEl.querySelector('.game-winner-badge')) {
          playerNameEl.insertAdjacentHTML('beforeend', '<span class="game-winner-badge">WINNER</span>');
        }
      }
      
      // Show result banner
      showGameResultBanner(pot, winnerInfo);
      
      // Reset game state
      appState.gameIsRunning = false;
      updateGameStartButton();
      
      return;
    }
    
    // Move to next index (circular)
    currentIndex = (currentIndex + 1) % tickets.length;
    stepCount++;
    
    // Slow down near the end
    const stepsRemaining = totalSteps - stepCount;
    if (stepsRemaining < 10) {
      speed += 50; // Gradually slow down
    } else if (stepsRemaining < 20) {
      speed += 30;
    } else if (stepsRemaining < 30) {
      speed += 15;
    }
    
    appState.gameSpinTimer = setTimeout(highlightStep, speed);
  }
  
  // Start animation
  highlightStep();
}

/**
 * Show game result banner
 */
function showGameResultBanner(pot, winnerInfo) {
  const resultBanner = document.getElementById('game-result-banner');
  const resultText = document.getElementById('game-result-text');
  const resultSubtext = document.getElementById('game-result-subtext');
  
  if (!resultBanner || !resultText || !resultSubtext) return;
  
  // Set result text
  if (winnerInfo.isYou) {
    resultText.textContent = 'You won the pot!';
  } else {
    resultText.textContent = `${escapeHtml(winnerInfo.publicName)} won the pot!`;
  }
  
  // Set subtext
  resultSubtext.textContent = `Pot: ${pot.totalTickets} tickets — Winner received ${pot.winnerPayout}, house kept ${pot.housePayout}.`;
  
  // Show banner
  resultBanner.style.display = 'block';
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


