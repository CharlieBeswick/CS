# Crypto Tickets - v1 Prototype

A mobile-first web application for free-to-enter transparent prize draws (tombolas).

## Overview

Crypto Tickets is a **100% free-to-use** application where users can:
- Sign in with Google
- Browse live and upcoming tombolas
- View transparent ticket boards (structure ready, full implementation in future versions)
- See public winners (structure ready, full implementation in future versions)

**Important:** This is v1, a working prototype with:
- Virtual/demo prizes only
- No real money deposits or wagers
- Mock data for testing
- Basic architecture ready for future enhancements

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Backend:** Node.js + Express
- **Authentication:** Google Identity Services
- **Data Storage:** JSON files (easily replaceable with a database)
- **Session Management:** Express sessions with HTTP-only cookies

## Project Structure

```
tombola-live/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── config/
│   └── google.json        # Google OAuth credentials (create from google.json.example)
├── data/
│   ├── tombolas.json      # Mock tombola data
│   └── users.json         # User data (auto-generated)
├── routes/
│   ├── auth.js            # Authentication routes
│   └── tombolas.js        # Tombola API routes
├── middleware/
│   └── authMiddleware.js  # Auth middleware
└── public/
    ├── index.html         # Main HTML
    ├── style.css          # Styles
    └── app.js             # Frontend JavaScript
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd tombola-live
npm install
```

### 2. Configure Google OAuth

You need to set up Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized JavaScript origins: `http://localhost:3000` (and your production domain)
7. Add authorized redirect URIs: `http://localhost:3000` (and your production domain)
8. Copy the Client ID and Client Secret

**Option A: Using config file (recommended for development)**
```bash
cp config/google.json.example config/google.json
# Edit config/google.json and add your credentials
```

**Option B: Using environment variables**
```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

**Option C: Demo mode**
If you don't configure credentials, the app will run in demo mode with a mock login (for testing UI only).

### 3. Update Frontend Google Client ID

Edit `public/app.js` and replace `'DEMO_CLIENT_ID'` with your actual Google Client ID:

```javascript
google.accounts.id.initialize({
  client_id: 'YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com',
  callback: handleGoogleSignIn,
});
```

### 4. Run the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

## Features in v1

### ✅ Implemented

- Google Sign-In with backend verification
- Session management (HTTP-only cookies)
- Mobile-first responsive UI with casino/neon theme
- Tombola lobby with live listings
- Status indicators (LIVE / PENDING / FINISHED)
- Countdown timers for active tombolas
- Bottom navigation (Lobby, My Tickets, History)
- Info & Rules modal with compliance text
- Tombola detail view
- Mock data structure ready for expansion

### 🚧 Placeholders (Structure Ready)

- **My Tickets:** Screen exists, shows "Coming soon"
- **History:** Screen exists, shows "Coming soon"
- **Ticket Entry:** API route placeholder exists (`POST /api/tombolas/:id/enter`)
- **Public Ticket Board:** API route placeholder exists (`GET /api/tombolas/:id/public-board`)
- **Winner Display:** Structure ready in data model

## API Endpoints

### Authentication

- `POST /auth/google` - Authenticate with Google ID token
- `GET /auth/me` - Get current user (if authenticated)
- `POST /auth/logout` - Logout current user

### Tombolas

- `GET /api/tombolas` - List all tombolas
- `GET /api/tombolas/:id` - Get tombola details
- `POST /api/tombolas/:id/enter` - Enter a draw (not implemented in v1)
- `GET /api/tombolas/:id/public-board` - Get public ticket board (not implemented in v1)

## Legal & Compliance

This application includes clear disclaimers stating:

- No real money is accepted
- Entry is completely free
- Rewards in this version are virtual/demo only
- This app does not offer real-money gambling

See the "Info & Rules" section in the app for full compliance text.

## Future Enhancements (TODOs)

The codebase includes TODO comments for:

1. **Database Integration:** Replace JSON files with a real database (PostgreSQL, MongoDB, etc.)
2. **Real Ticket Entry:** Implement free ticket entry system
3. **Public Ticket Boards:** Display all ticket numbers publicly
4. **Winner Announcements:** Show winners for finished tombolas
5. **Real Vouchers:** Integrate real gift voucher system (while maintaining free-entry model)
6. **Rewarded Ads:** Add ad integration for ticket acquisition
7. **Real-time Updates:** WebSockets or Server-Sent Events for live updates
8. **Admin Panel:** Management interface for creating/managing tombolas
9. **Authentication Requirements:** Add auth middleware to protected routes
10. **CSRF Protection:** Enhanced security measures

## Development Notes

- The app uses in-memory sessions (Express session with default MemoryStore)
- For production, consider using Redis or a database-backed session store
- All user data is stored in `data/users.json` (auto-created)
- Tombola data is in `data/tombolas.json` (editable)
- The frontend uses vanilla JavaScript with no build step required
- Mobile-first design optimized for ~480px width screens

## Troubleshooting

**Google Sign-In not working:**
- Verify your Client ID is correct in both `config/google.json` and `public/app.js`
- Check that your authorized origins include `http://localhost:3000`
- Check browser console for errors

**Session not persisting:**
- Ensure cookies are enabled in your browser
- Check that you're accessing via `http://localhost:3000` (not `127.0.0.1`)

**Port already in use:**
- Change the PORT in `server.js` or set `PORT` environment variable

## License

ISC

---

**Version:** 1.0.0  
**Status:** Prototype / MVP

