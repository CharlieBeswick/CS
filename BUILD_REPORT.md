# Crypto Tickets - Build Status Report

**Generated:** 2025-11-23  
**Version:** 1.0.0  
**Status:** Active Development - Phase 2 & 3 Complete

---

## 📋 Executive Summary

**Crypto Tickets** is a free-to-play tier-based ticket game platform built with Node.js/Express backend and vanilla HTML/CSS/JavaScript frontend. The application has recently completed a major rebranding from "Tombola Live" and introduced a comprehensive 8-tier ticket wallet system with reward mechanisms.

### Current State
- ✅ **Phase 1 Complete:** Full rebranding to "Crypto Tickets"
- ✅ **Phase 2 Complete:** 8-tier ticket wallet system implemented
- ✅ **Phase 3 Complete:** Ad rewards and daily free attempts system
- 🚧 **Phase 4 Pending:** Tier-based game queues and draw system
- 🚧 **Legacy System:** Old "tombola" system still functional but needs migration

---

## 🏗️ Architecture Overview

### Tech Stack
- **Backend:** Node.js 18+ with Express 4.18
- **Database:** Prisma ORM v6.19.0 with SQLite (Postgres-ready schema)
- **Frontend:** Vanilla HTML/CSS/JavaScript (no frameworks)
- **Authentication:** Google Identity Services (GIS) with Express sessions
- **Session Storage:** Express-session with HTTP-only cookies

### Project Structure
```
tombola-live/
├── server.js                 # Main Express server entry point
├── package.json              # Dependencies and scripts
├── config/
│   ├── google.json           # Google OAuth credentials
│   ├── admin.js              # Admin email whitelist
│   ├── tickets.js            # Ticket tier definitions & metadata
│   └── limits.js             # Configurable app limits
├── prisma/
│   ├── schema.prisma         # Database schema (6 models)
│   └── migrations/           # Database migration history
├── lib/
│   ├── prisma.js             # Prisma client singleton
│   └── walletHelpers.js       # Wallet operations (add/consume tickets)
├── middleware/
│   ├── authMiddleware.js      # Authentication middleware
│   └── adminMiddleware.js     # Admin role check middleware
├── routes/
│   ├── auth.js               # Google auth, /auth/me, logout
│   ├── wallet.js             # GET /api/wallet
│   ├── rewards.js            # POST /api/rewards/ad
│   ├── freeAttempts.js       # GET/POST /api/free-attempts/*
│   ├── profile.js            # User profile CRUD
│   ├── tickets.js            # Legacy ticket/credit endpoints
│   ├── tombolas.js           # Tombola listing & details
│   ├── board.js              # Ticket board & entry
│   ├── draw.js               # Draw resolution (80/20 split)
│   └── admin.js               # Admin tombola CRUD
├── public/                    # Player-facing mobile app
│   ├── index.html            # Main app shell
│   ├── app.js                # Frontend logic
│   └── style.css             # Mobile-first neon/dark theme
└── admin/                     # Separate admin panel (desktop)
    ├── index.html
    ├── admin.js
    └── admin.css
```

---

## 🎯 Implemented Features

### 1. Authentication & User Management
- ✅ Google Sign-In with backend token verification
- ✅ Express session management (HTTP-only cookies)
- ✅ User profile system (publicName, avatarUrl)
- ✅ Role-based access control (PLAYER/ADMIN)
- ✅ Admin email whitelist system
- ✅ First-time user profile completion flow

### 2. Ticket Wallet System (NEW - Phase 2)
- ✅ **8 Ticket Tiers:** BRONZE, SILVER, GOLD, EMERALD, SAPPHIRE, RUBY, AMETHYST, DIAMOND
- ✅ Per-user wallet stored in Prisma (JSON column)
- ✅ Wallet helper functions (`addTickets`, `consumeTickets`)
- ✅ Transaction logging for all wallet operations
- ✅ Wallet initialization on user creation
- ✅ API endpoint: `GET /api/wallet`

### 3. Reward System (NEW - Phase 3)
- ✅ **Ad Rewards:** `POST /api/rewards/ad` awards 1 BRONZE ticket
  - Currently accepts frontend calls (TODO: validate real ad network receipts)
  - TODO: Add rate limiting and abuse protection
- ✅ **Daily Free Attempts:** `POST /api/free-attempts/play`
  - 3 attempts per day (UTC day, server-enforced)
  - 1/20 (5%) chance to win 1 BRONZE ticket
  - Status endpoint: `GET /api/free-attempts/status`
  - All attempts logged in `FreeAttempt` table

### 4. Legacy Tombola System (Still Active)
- ✅ Tombola lobby with live/pending listings
- ✅ Tombola detail modal (Overview, Ticket Board, Game tabs)
- ✅ Ticket entry system (`POST /api/tombolas/:id/enter`)
  - Uses legacy `credits` field (1 credit = 1 entry)
  - TODO: Migrate to tier-based tickets
- ✅ Public ticket board (`GET /api/tombolas/:id/board`)
- ✅ Draw resolution system (`POST /api/tombolas/:id/draw`)
  - Server-side random winner selection
  - 80% to winner, 20% house cut
  - Animated spinning highlight on frontend
  - Prevents duplicate draws

### 5. Admin Panel
- ✅ Separate admin web app at `/admin/`
- ✅ Desktop-style layout (distinct from mobile app)
- ✅ Tombola CRUD operations
- ✅ Protected by admin role middleware
- ✅ Email-based admin whitelist

### 6. Frontend UI
- ✅ Mobile-first responsive design
- ✅ Neon/dark casino theme
- ✅ Bottom navigation (Lobby, My Tickets, History, Profile)
- ✅ Login screen with Google Sign-In
- ✅ Lobby screen with game cards
- ✅ Profile screen with wallet display
- ✅ My Tickets screen (legacy credits display)
- ✅ History screen (placeholder)
- ✅ Info & Rules modal with compliance text

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

### Enums
- `Role`: PLAYER, ADMIN
- `TombolaStatus`: DRAFT, LIVE, PENDING, FINISHED
- `DrawStatus`: PENDING, RUNNING, FINISHED, CANCELLED

---

## 🔌 API Endpoints

### Authentication
- `POST /auth/google` - Authenticate with Google ID token
- `GET /auth/me` - Get current authenticated user
- `POST /auth/logout` - End session

### Wallet (NEW)
- `GET /api/wallet` - Get user's 8-tier ticket wallet

### Rewards (NEW)
- `POST /api/rewards/ad` - Award 1 BRONZE for ad view

### Free Attempts (NEW)
- `GET /api/free-attempts/status` - Get remaining attempts for today
- `POST /api/free-attempts/play` - Play free mini-game (1/20 chance)

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update publicName, avatarUrl

### Tickets (Legacy)
- `GET /api/tickets` - Get credits balance (deprecated)
- `POST /api/tickets/reward` - Award credits (deprecated, use `/api/rewards/ad`)

### Tombolas (Legacy)
- `GET /api/tombolas` - List all tombolas (LIVE/PENDING only)
- `GET /api/tombolas/:id` - Get tombola details
- `GET /api/tombolas/:id/board` - Get ticket board
- `POST /api/tombolas/:id/enter` - Enter draw (uses legacy credits)
- `POST /api/tombolas/:id/draw` - Resolve draw (admin only)

### Admin
- `GET /api/admin/tombolas` - List all tombolas (admin)
- `POST /api/admin/tombolas` - Create tombola (admin)
- `PUT /api/admin/tombolas/:id` - Update tombola (admin)
- `DELETE /api/admin/tombolas/:id` - Delete tombola (admin)

---

## 📝 Recent Changes (Last Session)

### Phase 1: Branding Migration ✅
- Rebranded from "Tombola Live" to "Crypto Tickets"
- Updated all user-facing text, titles, and labels
- Updated admin panel terminology ("raffles" → "games")
- Added meta description to HTML

### Phase 2: Ticket Tier System ✅
- Created `config/tickets.js` with 8-tier definitions
- Added `ticketWallet` JSON column to User model
- Implemented `lib/walletHelpers.js` with atomic operations
- Created `GET /api/wallet` endpoint
- Updated user creation to initialize empty wallet
- Added transaction logging with tier tracking

### Phase 3: Economy System ✅
- Implemented `POST /api/rewards/ad` for ad rewards
- Implemented `POST /api/free-attempts/play` with daily limits
- Created `FreeAttempt` model for attempt tracking
- Added server-side enforcement of 3 attempts per day
- Added 1/20 win probability logic

---

## 🚧 Outstanding TODOs

### 🔴 High Priority

1. **Frontend Wallet UI**
   - Display 8-tier wallet in "My Tickets" screen
   - Replace legacy "credits" display with tier cards
   - Show tier colors and balances
   - Wire up ad reward button to new endpoint
   - Add free attempts UI with remaining count

2. **Migrate Legacy Credits to Wallet**
   - Convert existing `credits` to `BRONZE` tickets
   - Update `POST /api/tombolas/:id/enter` to use wallet
   - Remove deprecated `credits` field usage

3. **Tier-Based Game System**
   - Implement 8 tier games (Bronze → Diamond)
   - Create queue system (Small/Medium/Large per tier)
   - Entry costs: 1 ticket of that tier
   - Rewards: 1/2/3 tickets of next tier

4. **Security & Validation**
   - Add ad network receipt validation to `/api/rewards/ad`
   - Implement rate limiting for reward endpoints
   - Restrict draw start to admins only (currently any user)

### 🟡 Medium Priority

5. **Admin Panel Enhancements**
   - Date/time pickers for tombola scheduling
   - Soft delete for tombolas
   - Archive functionality
   - Bulk operations

6. **Real-time Features**
   - WebSocket/SSE for live ticket board updates
   - Real-time draw viewing
   - Live wallet balance updates

7. **User Experience**
   - History screen implementation
   - Transaction history display
   - Winner announcement UI
   - Daily limits UI feedback

### 🟢 Low Priority

8. **Infrastructure**
   - Migrate from SQLite to PostgreSQL
   - Redis session store for production
   - Add comprehensive error logging
   - Performance monitoring

9. **Advanced Features**
   - Search and filtering for tombolas
   - Pagination for large lists
   - Export/import functionality
   - Audit logging for admin actions

---

## 🔄 Migration Status

### Completed Migrations
- ✅ JSON file storage → Prisma + SQLite
- ✅ In-memory user store → Database-backed
- ✅ Admin whitelist → Role-based (PLAYER/ADMIN)
- ✅ Tombola CRUD → Database-backed
- ✅ Ticket entry → Database-backed with transactions
- ✅ Draw resolution → Database-backed with transactions

### Pending Migrations
- 🚧 Legacy `credits` → `ticketWallet` (BRONZE)
- 🚧 Tombola system → Tier-based game system
- 🚧 Old ticket entry → Tier-based entry
- 🚧 Old draw system → Tier queue system

---

## 🐛 Known Issues

1. **Dual Currency System**
   - Both `credits` and `ticketWallet` exist
   - Frontend still displays `credits` in some places
   - Need unified wallet display

2. **Legacy Endpoints**
   - `/api/tickets/reward` still uses old credits system
   - Should be deprecated in favor of `/api/rewards/ad`

3. **Draw Access Control**
   - Any logged-in user can start draws
   - Should be admin-only

4. **Frontend Wallet Display**
   - "My Tickets" screen shows legacy credits
   - Needs 8-tier wallet visualization

---

## 📊 Statistics

- **Total Routes:** 10 route modules
- **Database Models:** 6 Prisma models
- **API Endpoints:** 20+ endpoints
- **Frontend Screens:** 5 main screens
- **Ticket Tiers:** 8 tiers defined
- **TODOs:** 32+ items across codebase

---

## 🎯 Next Steps (Recommended Priority)

1. **Immediate (This Week)**
   - Implement frontend wallet UI (8-tier display)
   - Wire ad reward button to new endpoint
   - Add free attempts UI
   - Migrate legacy credits display

2. **Short-term (Next 2 Weeks)**
   - Implement tier-based game queues
   - Migrate tombola entry to use wallet
   - Add admin-only draw restriction
   - Complete history screen

3. **Medium-term (Next Month)**
   - Real ad network integration
   - Rate limiting and abuse protection
   - Real-time updates (WebSocket)
   - Production deployment prep

---

## 📚 Documentation

- **README.md** - Setup and overview (needs update for new features)
- **TODO.md** - Comprehensive TODO list
- **BUILD_REPORT.md** - This document

---

**Report Generated:** 2025-11-23  
**Last Major Update:** Phase 3 (Ad Rewards & Free Attempts)  
**Next Review:** After frontend wallet UI implementation

