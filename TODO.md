# TODO List - Crypto Tickets

This document lists all TODO comments found throughout the codebase, organized by file and priority.

## 🔴 High Priority / Critical

### Authentication & Security
- **`routes/auth.js:25`** - Replace in-memory user store with database
- **`config/admin.js:13`** - Adjust admin email whitelist as needed
- **`routes/draw.js:100`** - Restrict draw start to admins only (currently allows any logged-in user)

### Data Integrity
- **`public/app.js:812`** - Update tombola status to FINISHED when countdown reaches 0
- **`public/app.js:1244`** - Check if draw is already finished before allowing start
- **`routes/board.js:149`** - Add server-side limits (max entries per user, time windows, etc.)

## 🟡 Medium Priority / Important Features

### Admin Panel
- **`routes/admin.js:78-79`** - Implement soft delete instead of hard delete for tombolas
- **`routes/admin.js:79`** - Add archive functionality for tombolas
- **`admin/index.html:97,103`** - Add date/time picker for start/end time fields (currently text input)

### Ticket System
- **`routes/tickets.js:77`** - Add daily limits per reward type
- **`routes/tickets.js:78`** - Integrate with real ad callbacks (Google AdMob)
- **`routes/tickets.js:79`** - Add reward history logging
- **`routes/tickets.js:100`** - Check daily limits before awarding rewards
- **`routes/tickets.js:117`** - Log reward to history

### Tombola Management
- **`routes/tombolas.js:21`** - Add pagination, filtering by status, sorting
- **`routes/tombolas.js:22`** - Require authentication for tombola listing (currently public)
- **`routes/tombolas.js:37`** - Add public ticket board data to tombola details
- **`routes/tombolas.js:38`** - Add winner information for finished tombolas

## 🟢 Low Priority / Future Enhancements

### Infrastructure & Architecture
- **`data/ticketStore.js:5`** - Replace JSON file storage with database
- **`store/tombolasStore.js:5-9`** - Replace with database (PostgreSQL, MongoDB, etc.)
- **`store/tombolasStore.js:7`** - Add soft delete functionality
- **`store/tombolasStore.js:8`** - Add pagination and filtering
- **`store/tombolasStore.js:9`** - Add search functionality

### Authentication & Authorization
- **`middleware/authMiddleware.js:5`** - Enhance with JWT verification or more sophisticated session management
- **`middleware/adminMiddleware.js:5-8`** - Add role-based access control (super admin, moderator, etc.)
- **`middleware/adminMiddleware.js:7`** - Add permission levels for different admin actions
- **`middleware/adminMiddleware.js:8`** - Add audit logging for admin actions
- **`config/admin.js:5-8`** - Move to database with role-based access control
- **`config/admin.js:7`** - Add admin roles (super admin, moderator, etc.)
- **`config/admin.js:8`** - Add audit logging for admin actions

### Real-time Features
- **`routes/tombolas.js:9`** - Add real-time updates via WebSockets or SSE
- **`routes/board.js:5`** - Add real-time websocket updates for ticket board
- **`routes/draw.js:5`** - Add websocket/real-time updates for multiple viewers

### Admin Features
- **`routes/admin.js:5-10`** - Add role-based permissions (super admin, moderator, etc.)
- **`routes/admin.js:7`** - Add audit logging for all admin actions
- **`routes/admin.js:8`** - Add bulk operations
- **`routes/admin.js:9`** - Add export/import functionality
- **`routes/admin.js:10`** - Add scheduling system for automatic status changes

### Draw System
- **`routes/draw.js:5`** - Restrict draw start to admins only
- **`routes/draw.js:5`** - Add scheduled draws (automatic at specific times)
- **`routes/draw.js:5`** - Add websocket/real-time updates for multiple viewers
- **`routes/draw.js:5`** - Better house accounting system
- **`routes/draw.js:5`** - Protection against repeated draws on finished tombola
- **`routes/draw.js:5`** - More complex draw status persistence

### Legacy TODOs (Already Implemented)
- **`routes/tombolas.js:6-7`** - ~~Add POST /api/tombolas/:id/enter~~ ✅ Implemented in `routes/board.js`
- **`routes/tombolas.js:7`** - ~~Add GET /api/tombolas/:id/public-board~~ ✅ Implemented in `routes/board.js`

## Summary by Category

### Database Migration
- Replace all JSON file storage with proper database
- User store → Database
- Ticket store → Database
- Tombola store → Database

### Security & Access Control
- Restrict draw start to admins
- Add role-based access control
- Add audit logging
- Add permission levels

### Real-time Features
- WebSocket/SSE for live updates
- Real-time ticket board updates
- Real-time draw viewing

### Admin Enhancements
- Soft delete for tombolas
- Archive functionality
- Bulk operations
- Export/import
- Scheduling system
- Date/time pickers

### User Experience
- Pagination and filtering
- Search functionality
- Daily limits
- Reward history
- Winner information display

### Integration
- Real ad callbacks (Google AdMob)
- Better house accounting
- Scheduled draws

---

**Last Updated:** 2025-11-23
**Total TODOs Found:** 32+ items across 12 files

