# Crypto Tickets - Status Report & TODO Summary

**Generated:** 2025-11-23  
**Version:** 1.0.0  
**Status:** Phase 4 Complete - Admin Panel Redesigned

---

## 📋 Executive Summary

**Crypto Tickets** is a free-to-play, tier-based ticket game platform currently in active development. The application has completed Phases 1-4, including full rebranding, 8-tier wallet system, reward mechanisms, and a redesigned admin panel. The system is built on Node.js/Express with Prisma ORM and SQLite, ready for PostgreSQL migration.

### Current Phase Status
- ✅ **Phase 1:** Complete - Full rebranding to "Crypto Tickets"
- ✅ **Phase 2:** Complete - 8-tier ticket wallet system (backend + API)
- ✅ **Phase 3:** Complete - Ad rewards and daily free attempts
- ✅ **Phase 4:** Complete - Frontend wallet UI + Promotions screen + Admin panel redesign
- 🚧 **Phase 5:** Pending - Tier-based game queue system

---

## 🎯 Completed Features

### 1. Authentication & User Management ✅
- Google Sign-In with backend token verification
- Express session management (HTTP-only cookies)
- User profile system (publicName, avatarUrl)
- Role-based access control (PLAYER/ADMIN)
- Admin email whitelist → Database role system
- First-time user profile completion flow

### 2. Ticket Wallet System ✅
- **8 Ticket Tiers:** BRONZE, SILVER, GOLD, EMERALD, SAPPHIRE, RUBY, AMETHYST, DIAMOND
- Per-user wallet stored in Prisma (JSON column)
- Wallet helper functions (`addTickets`, `consumeTickets`) with atomic transactions
- Transaction logging for all wallet operations
- Wallet initialization on user creation
- API endpoints: `GET /api/wallet`

### 3. Reward System ✅
- **Ad Rewards:** `POST /api/rewards/ad` awards 1 BRONZE ticket
- **Daily Free Attempts:** `POST /api/free-attempts/play`
  - 3 attempts per day (UTC day, server-enforced)
  - 1/20 (5%) chance to win 1 BRONZE ticket
  - Status endpoint: `GET /api/free-attempts/status`
  - All attempts logged in `FreeAttempt` table

### 4. Frontend UI ✅
- **Home/Lobby Screen:**
  - Compact "Your Tickets" summary (2×4 grid of tier pills)
  - "How Crypto Tickets Works" explanation section
  - Visual tier ladder (BRONZE → DIAMOND)
  - Tier game buttons (Tier 1-7 + Tier 8 coming soon) - stubs ready
- **My Tickets Screen:**
  - Full 8-tier wallet grid (2×4)
  - Recent activity list
- **Promotions Screen:**
  - Daily Free Attempts panel with remaining count
  - Rewarded Ad panel
  - Accessible via header button
- **Profile Screen:**
  - User profile editing
  - Ticket wallet display
  - Sign out button

### 5. Admin Panel (Redesigned) ✅
- **Current Games Section:**
  - Shows LIVE and PENDING tombolas
  - Displays ticket counts
  - Shows time remaining for games with end times
  - Quick actions: "Extend +15min" for PENDING games
  - "Start Draw" button for LIVE games
- **Previous Games Section:**
  - Shows FINISHED tombolas
  - Expandable details showing:
    - Winner name and email
    - Winning ticket number
    - Payout amounts (winner + house)
    - Pot size
    - Time won (finishedAt timestamp)
- **Game Details Panel:**
  - Shows when a game is selected
  - Displays comprehensive game information
  - Shows draw results for finished games
  - Edit button to modify game
- **Timer Controls:**
  - `PUT /api/admin/tombolas/:id/timer` endpoint
  - Extend time functionality (add minutes to endTime)
  - Auto-start logic (placeholder for future queue system)
- **Create/Edit Form:**
  - Date/time pickers for start/end times (datetime-local inputs)
  - All game fields editable

### 6. Legacy Tombola System (Still Functional) ✅
- Tombola CRUD operations (database-backed)
- Ticket entry system (`POST /api/tombolas/:id/enter`)
- Public ticket board (`GET /api/tombolas/:id/board`)
- Draw resolution system (`POST /api/tombolas/:id/draw`)
  - Server-side random winner selection
  - 80% to winner, 20% house cut
  - Prevents duplicate draws

---

## 🗄️ Database Schema

### Models (Prisma)

1. **User**
   - Authentication: `googleSub`, `email`, `name`, `picture`
   - Profile: `publicName`, `avatarUrl`
   - Wallet: `credits` (deprecated), `ticketWallet` (JSON: 8-tier balances)
   - Role: `role` (PLAYER/ADMIN)
   - Relations: Tickets, Draws, CreditTransactions, FreeAttempts

2. **Tombola**
   - Identity: `id`, `slug` (unique)
   - Details: `name`, `prize`, `description`
   - Status: `status` (DRAFT/LIVE/PENDING/FINISHED)
   - Economics: `houseCutRatio` (default 0.2)
   - Timing: `startTime`, `endTime`
   - Relations: Tickets, Draws

3. **Ticket**
   - Identity: `id`, `number` (sequential per tombola)
   - Relations: `tombolaId`, `userId`
   - Metadata: `createdAt`
   - Used in: Draw winner selection

4. **Draw**
   - Identity: `id`, `tombolaId`
   - Status: `status` (PENDING/RUNNING/FINISHED/CANCELLED)
   - Timing: `startedAt`, `finishedAt`
   - Results: `potSize`, `winnerTicketId`, `winnerUserId`, `winnerPayout`, `housePayout`
   - Relations: Tombola, Ticket (winner), User (winner)

5. **CreditTransaction**
   - Identity: `id`, `userId`
   - Amount: `amount` (positive/negative)
   - Metadata: `reason`, `tier` (for new wallet system), `meta` (JSON)
   - Timing: `createdAt`
   - Purpose: Audit trail for all wallet operations

6. **FreeAttempt**
   - Identity: `id`, `userId`
   - Result: `didWin`, `awardedTier`
   - Timing: `createdAt`
   - Purpose: Track daily free mini-game attempts

---

## 🔌 API Endpoints

### Authentication
- `POST /auth/google` - Authenticate with Google ID token
- `GET /auth/me` - Get current authenticated user
- `POST /auth/logout` - End session

### Wallet
- `GET /api/wallet` - Get user's 8-tier ticket wallet

### Rewards
- `POST /api/rewards/ad` - Award 1 BRONZE for ad view

### Free Attempts
- `GET /api/free-attempts/status` - Get remaining attempts for today
- `POST /api/free-attempts/play` - Play free mini-game (1/20 chance)

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update publicName, avatarUrl

### Tickets (Legacy - Deprecated)
- `GET /api/tickets` - Get credits balance (deprecated)
- `POST /api/tickets/reward` - Award credits (deprecated, use `/api/rewards/ad`)

### Tombolas (Legacy)
- `GET /api/tombolas` - List all tombolas (LIVE/PENDING only)
- `GET /api/tombolas/:id` - Get tombola details
- `GET /api/tombolas/:id/board` - Get ticket board
- `POST /api/tombolas/:id/enter` - Enter draw (uses legacy credits)
- `POST /api/tombolas/:id/draw` - Resolve draw (admin only)

### Admin
- `GET /api/admin/tombolas` - List all tombolas with enhanced data (ticket counts, draw info)
- `POST /api/admin/tombolas` - Create tombola (admin)
- `PUT /api/admin/tombolas/:id` - Update tombola (admin)
- `PUT /api/admin/tombolas/:id/timer` - Extend timer or auto-start (admin)
- `DELETE /api/admin/tombolas/:id` - Delete tombola (admin)

---

## 📝 Comprehensive TODO List

### 🔴 High Priority / Critical

#### 1. Tier-Based Game Queue System
**Status:** Not Started  
**Priority:** Critical for core functionality

- [ ] Design and implement Prisma schema for tier queues:
  - `TierGameQueue` model (tier, queue size: 20/40/60, status)
  - `QueueEntry` model (user entry into a queue)
  - Queue status tracking (WAITING, FILLED, IN_PROGRESS, FINISHED)
- [ ] Implement queue creation logic:
  - 8 tiers (Bronze → Diamond)
  - 3 queue sizes per tier (Small: 20, Medium: 40, Large: 60)
  - Entry cost: 1 ticket of that tier (burned on resolution)
  - Rewards: 1/2/3 tickets of next tier (based on queue size)
- [ ] Implement queue entry endpoint:
  - `POST /api/tier-games/:tier/:size/join`
  - Validate user has required tier ticket
  - Atomically consume ticket and create queue entry
- [ ] Implement queue resolution:
  - Auto-resolve when queue fills
  - Random winner selection
  - Award next-tier tickets
  - Burn entry tickets
- [ ] Frontend integration:
  - Replace stub tier game buttons with real queue join logic
  - Show queue status (players in queue, time remaining)
  - Display queue results

**Files to modify:**
- `prisma/schema.prisma` - Add TierGameQueue and QueueEntry models
- `routes/tierGames.js` - New route file for tier game operations
- `lib/queueHelpers.js` - Queue management functions
- `public/app.js` - Update `handleTierGameClick()` to join queues
- `public/index.html` - Update tier game buttons UI

#### 2. Migrate Legacy Credits to Wallet
**Status:** Partially Complete  
**Priority:** High

- [ ] Convert existing `credits` values to `BRONZE` tickets in wallet
- [ ] Update `POST /api/tombolas/:id/enter` to use wallet instead of credits
- [ ] Remove all frontend references to `credits` display
- [ ] Add migration script to convert existing user credits
- [ ] Mark `credits` field as fully deprecated (remove from new user creation)

**Files to modify:**
- `routes/board.js` - Update entry logic to use `consumeTickets(userId, 'BRONZE', 1)`
- `routes/draw.js` - Update winner payout to use `addTickets()` instead of credits increment
- `prisma/schema.prisma` - Mark credits field with stronger deprecation notice
- `lib/migrations.js` - Create migration script (new file)

#### 3. Admin Draw Restriction
**Status:** Partially Complete (backend has requireAdmin, but frontend allows any user)  
**Priority:** High

- [ ] Verify `POST /api/tombolas/:id/draw` is properly protected by `requireAdmin`
- [ ] Update frontend to hide "Start Draw" button for non-admins
- [ ] Add proper error handling for unauthorized draw attempts

**Files to modify:**
- `routes/draw.js` - Verify `requireAdmin` middleware is applied
- `public/app.js` - Check user role before showing draw controls

#### 4. Ad Network Receipt Validation
**Status:** Not Started  
**Priority:** High (for production)

- [ ] Implement receipt/token validation for real ad networks (AdMob, etc.)
- [ ] Add rate limiting to prevent abuse
- [ ] Add daily limits per user for ad rewards
- [ ] Store ad receipt IDs to prevent duplicate claims

**Files to modify:**
- `routes/rewards.js` - Add receipt validation logic
- `lib/adValidation.js` - New file for ad network integration
- `config/limits.js` - Add ad reward limits

---

### 🟡 Medium Priority / Important Features

#### 5. History Screen Implementation
**Status:** Placeholder Only  
**Priority:** Medium

- [ ] Create API endpoint: `GET /api/history`
  - Returns user's transaction history
  - Includes: ad rewards, free attempts, game entries, wins
  - Filterable by type, date range
- [ ] Implement frontend history screen:
  - Display transaction list
  - Show tier changes
  - Display game wins/losses
  - Add filtering options

**Files to modify:**
- `routes/history.js` - New route file
- `public/app.js` - History screen rendering logic
- `public/index.html` - History screen HTML (already exists, needs content)

#### 6. Real-time Features
**Status:** Not Started  
**Priority:** Medium

- [ ] Implement WebSocket or Server-Sent Events (SSE)
- [ ] Real-time wallet balance updates
- [ ] Live ticket board updates
- [ ] Real-time queue status updates
- [ ] Live draw viewing for multiple users

**Files to create:**
- `lib/websocket.js` or `lib/sse.js` - Real-time communication
- `routes/realtime.js` - Real-time event endpoints

#### 7. Enhanced Admin Features
**Status:** Partially Complete  
**Priority:** Medium

- [ ] Add bulk operations (delete multiple games, change status)
- [ ] Add export/import functionality
- [ ] Add audit logging for all admin actions
- [ ] Add scheduling system for automatic status changes
- [ ] Add queue management UI (view/manage tier queues)

**Files to modify:**
- `routes/admin.js` - Add bulk operation endpoints
- `admin/admin.js` - Add bulk operation UI
- `lib/auditLog.js` - New file for audit logging

#### 8. Rate Limiting & Abuse Prevention
**Status:** Not Started  
**Priority:** Medium

- [ ] Implement rate limiting middleware
- [ ] Add daily limits for ad rewards
- [ ] Add fraud detection (unusual patterns)
- [ ] Add IP-based rate limiting

**Files to create:**
- `middleware/rateLimiter.js` - Rate limiting middleware
- `config/limits.js` - Expand with more limit configurations

---

### 🟢 Low Priority / Future Enhancements

#### 9. Infrastructure Improvements
**Status:** Not Started  
**Priority:** Low

- [ ] Migrate from SQLite to PostgreSQL
- [ ] Add Redis session store for production
- [ ] Add comprehensive error logging (Winston, etc.)
- [ ] Add performance monitoring
- [ ] Add database backup/restore scripts

#### 10. Advanced Features
**Status:** Not Started  
**Priority:** Low

- [ ] Search and filtering for tombolas/games
- [ ] Pagination for large lists
- [ ] Export/import functionality
- [ ] Advanced analytics dashboard
- [ ] Email notifications for wins
- [ ] Push notifications (if mobile app)

#### 11. Code Cleanup
**Status:** Ongoing  
**Priority:** Low

- [ ] Remove all deprecated `credits` references
- [ ] Remove legacy tombola system after tier queues are implemented
- [ ] Clean up unused JSON file stores
- [ ] Remove TODO comments for completed features
- [ ] Update README.md with current features

---

## 🔄 Migration Status

### ✅ Completed Migrations
- JSON file storage → Prisma + SQLite
- In-memory user store → Database-backed
- Admin whitelist → Role-based (PLAYER/ADMIN)
- Tombola CRUD → Database-backed
- Ticket entry → Database-backed with transactions
- Draw resolution → Database-backed with transactions
- Admin panel → Enhanced with current/previous games display

### 🚧 Pending Migrations
- Legacy `credits` → `ticketWallet` (BRONZE)
- Tombola system → Tier-based game system
- Old ticket entry → Tier-based entry
- Old draw system → Tier queue system

---

## 🐛 Known Issues

1. **Dual Currency System**
   - Both `credits` and `ticketWallet` exist
   - Some frontend displays still show legacy credits
   - Need unified wallet display everywhere

2. **Legacy Endpoints**
   - `/api/tickets/reward` still uses old credits system
   - Should be fully deprecated in favor of `/api/rewards/ad`

3. **Frontend Wallet Display**
   - Profile wallet still shows "Credits" label (should be "Tickets")
   - Some screens may not update wallet after operations

4. **Google Sign-In Origin Error**
   - Console shows origin not allowed error
   - Requires Google Cloud Console configuration
   - Does not affect functionality if user manually triggers sign-in

---

## 📊 Statistics

- **Total Routes:** 10 route modules
- **Database Models:** 6 Prisma models
- **API Endpoints:** 25+ endpoints
- **Frontend Screens:** 6 main screens (Login, Lobby, My Tickets, History, Profile, Promotions)
- **Ticket Tiers:** 8 tiers defined
- **TODOs Found:** 72+ TODO/FIXME comments across codebase
- **Admin Features:** Current lobby display, previous games with expandable details, timer controls

---

## 🎯 Next Steps (Recommended Priority)

### Immediate (This Week)
1. ✅ **DONE:** Admin panel redesign with current/previous games
2. ✅ **DONE:** Timer controls for lobbies
3. Test admin panel functionality
4. Verify wallet loading on all screens

### Short-term (Next 2 Weeks)
1. Implement tier-based game queue system (Phase 5)
2. Migrate legacy credits to wallet (BRONZE conversion)
3. Update all frontend displays to use wallet instead of credits
4. Complete history screen implementation

### Medium-term (Next Month)
1. Real ad network integration (AdMob receipt validation)
2. Rate limiting and abuse protection
3. Real-time updates (WebSocket/SSE)
4. Enhanced admin features (bulk operations, audit logging)

### Long-term (Future)
1. PostgreSQL migration
2. Production deployment preparation
3. Advanced analytics
4. Mobile app considerations

---

## 📚 Documentation Files

- **README.md** - Setup and overview (needs update for new features)
- **TODO.md** - Comprehensive TODO list (needs refresh)
- **BUILD_REPORT.md** - Previous build status report
- **STATUS_REPORT.md** - This document (current state)

---

## 🔍 Feature Alignment Check

### ✅ Aligned Features
- **Branding:** All user-facing text uses "Crypto Tickets"
- **Wallet System:** 8-tier system implemented and displayed
- **Reward System:** Ad rewards and free attempts working
- **Admin Panel:** Shows current lobby and previous games with details
- **Timer Controls:** Extend timer functionality implemented

### ⚠️ Partially Aligned
- **Credits vs Wallet:** Dual system exists, migration in progress
- **Tier Games:** Buttons exist but are stubs (queues not implemented)
- **History Screen:** Placeholder exists, needs implementation

### ❌ Not Yet Aligned
- **Tier Queue System:** Not implemented (Phase 5)
- **Legacy Tombola System:** Still functional but will be replaced
- **Real Ad Integration:** Using stub endpoints

---

## 🎨 UI/UX Status

### Player App (Mobile-First)
- ✅ Login screen with Google Sign-In
- ✅ Lobby with wallet summary and tier buttons
- ✅ My Tickets with 8-tier wallet grid
- ✅ Promotions screen with free attempts and ad rewards
- ✅ Profile screen with wallet display
- ⚠️ History screen (placeholder only)

### Admin Panel (Desktop)
- ✅ Current games lobby display
- ✅ Previous games with expandable winner details
- ✅ Timer controls (extend time)
- ✅ Game creation/editing form
- ✅ Selected game details panel
- ✅ Date/time pickers for scheduling

---

## 🔒 Security Status

### ✅ Implemented
- HTTP-only session cookies
- Admin role-based access control
- Server-side validation for all operations
- Atomic transactions for critical operations
- Input sanitization (escapeHtml functions)

### ⚠️ Needs Improvement
- Rate limiting (not yet implemented)
- Ad receipt validation (stub only)
- CSRF protection (consider adding)
- Audit logging (not yet implemented)

---

## 📈 Performance Considerations

### Current
- SQLite database (suitable for development)
- In-memory session store (not suitable for production)
- No caching layer
- No rate limiting

### Recommended for Production
- PostgreSQL database
- Redis session store
- Redis caching layer
- Rate limiting middleware
- CDN for static assets

---

## 🧪 Testing Status

### Manual Testing Required
- [ ] Admin panel: Current games display
- [ ] Admin panel: Previous games expandable details
- [ ] Admin panel: Timer extension functionality
- [ ] Admin panel: Start draw from admin panel
- [ ] Frontend: Wallet loading on all screens
- [ ] Frontend: Ad rewards update wallet correctly
- [ ] Frontend: Free attempts update wallet correctly
- [ ] Frontend: Tier game buttons show "coming soon" message

### Automated Testing
- Not yet implemented
- Recommended: Add unit tests for wallet operations
- Recommended: Add integration tests for API endpoints

---

## 📋 Admin Panel Features Summary

### Current Implementation ✅

1. **Current Games Section**
   - Lists LIVE and PENDING tombolas
   - Shows ticket count per game
   - Displays time remaining (if endTime set)
   - Quick actions:
     - "Extend +15min" button for PENDING games
     - "Start Draw" button for LIVE games
   - Click to select and view details

2. **Previous Games Section**
   - Lists FINISHED tombolas
   - Expandable/collapsible details
   - Winner information:
     - Winner name (publicName)
     - Winner email
     - Winning ticket number
     - Payout amounts (winner + house)
     - Pot size
     - Time won (finishedAt)

3. **Selected Game Details Panel**
   - Shows when game is selected
   - Displays comprehensive game info
   - Shows draw results for finished games
   - Edit button to modify game

4. **Timer Controls**
   - `PUT /api/admin/tombolas/:id/timer` endpoint
   - Extend time by minutes
   - Auto-start placeholder (for future queue system)

5. **Create/Edit Form**
   - All game fields editable
   - Date/time pickers (datetime-local)
   - Status management
   - House cut configuration

---

## 🚀 Deployment Readiness

### Ready for Production
- ✅ Database schema (Postgres-ready)
- ✅ Role-based access control
- ✅ Session management
- ✅ Error handling
- ✅ Transaction safety

### Needs Work Before Production
- ⚠️ Rate limiting
- ⚠️ Ad receipt validation
- ⚠️ PostgreSQL migration
- ⚠️ Redis session store
- ⚠️ Error logging system
- ⚠️ Environment variable configuration
- ⚠️ HTTPS enforcement
- ⚠️ CORS configuration for production

---

## 📝 Code Quality Notes

### Strengths
- Clean separation of concerns (routes, middleware, lib)
- Atomic transactions for critical operations
- Comprehensive error handling
- Well-commented code
- Consistent naming conventions

### Areas for Improvement
- Remove deprecated code after migration
- Add unit tests
- Add integration tests
- Improve error messages for users
- Add request validation middleware
- Add response standardization

---

## 🎯 Feature Completion Matrix

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Google Auth | ✅ | ✅ | Complete |
| 8-Tier Wallet | ✅ | ✅ | Complete |
| Ad Rewards | ✅ | ✅ | Complete |
| Free Attempts | ✅ | ✅ | Complete |
| Wallet UI | ✅ | ✅ | Complete |
| Promotions Screen | ✅ | ✅ | Complete |
| Admin Panel | ✅ | ✅ | Complete |
| Tier Queues | ❌ | ⚠️ (stubs) | Not Started |
| History Screen | ❌ | ⚠️ (placeholder) | Not Started |
| Real Ad Integration | ⚠️ (stub) | ✅ | Partial |

---

**Report Generated:** 2025-11-23  
**Last Major Update:** Phase 4 (Admin Panel Redesign)  
**Next Review:** After tier queue system implementation

---

## 📌 Quick Reference

### Key Files
- **Schema:** `prisma/schema.prisma`
- **Wallet Config:** `config/tickets.js`
- **Admin Config:** `config/admin.js`
- **Wallet Helpers:** `lib/walletHelpers.js`
- **Main Server:** `server.js`
- **Player App:** `public/index.html`, `public/app.js`
- **Admin Panel:** `admin/index.html`, `admin/admin.js`

### Key Endpoints
- Wallet: `GET /api/wallet`
- Ad Reward: `POST /api/rewards/ad`
- Free Attempt: `POST /api/free-attempts/play`
- Admin Games: `GET /api/admin/tombolas`
- Timer Control: `PUT /api/admin/tombolas/:id/timer`

### Database
- **Type:** SQLite (dev) / PostgreSQL-ready (prod)
- **ORM:** Prisma 6.19.0
- **Location:** `prisma/dev.db`

---

**End of Report**

