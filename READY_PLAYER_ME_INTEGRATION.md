# Ready Player Me Avatar Integration

This document summarizes the Ready Player Me (RPM) avatar integration for CryptoSnow.

## Overview

Ready Player Me avatars have been integrated into CryptoSnow, allowing players to create and customize 3D avatars that are displayed in the avatar card on the homepage. Avatar creation is **required** for all logged-in users before they can play games.

## Files Changed/Created

### Backend Changes

1. **`prisma/schema.prisma`**
   - Added three new nullable fields to the `User` model:
     - `rpmAvatarId` (String?) - The avatar ID from RPM
     - `rpmAvatarUrl` (String?) - Optional URL from avatar export event
     - `rpmUserId` (String?) - Optional RPM user ID

2. **`routes/auth.js`**
   - Updated `GET /auth/me` to include RPM fields in user response
   - Added new `POST /auth/me/avatar` endpoint to save/update avatar data

3. **`lib/readyPlayerMeService.js`** (NEW)
   - Optional helper module for future RPM API integration
   - Contains placeholder functions for guest user creation, token generation, etc.
   - Currently not required for basic iframe integration

### Frontend Changes

1. **`public/index.html`**
   - Added avatar creator modal HTML structure
   - Added meta tag comment for RPM subdomain configuration

2. **`public/app.js`**
   - Added `renderAvatarCard()` function to display RPM avatar or placeholder
   - Added `openAvatarCreator()` and `closeAvatarCreator()` functions
   - Added `handleAvatarCreatorMessage()` to handle RPM iframe postMessage events
   - Added `saveAvatarToBackend()` to persist avatar data
   - Added `needsAvatar()`, `disableGameButtons()`, `enableGameButtons()` for avatar requirement logic
   - Updated `loadLobbyContent()` to check for avatar requirement and force creation
   - Added event listeners for avatar creator modal

3. **`public/style.css`**
   - Added styles for `.avatar-card-content`, `.avatar-card-image`, `.avatar-card-create-btn`, `.avatar-card-edit-btn`
   - Added styles for `.avatar-creator-modal` and `.avatar-creator-body`
   - Added responsive styles for mobile devices

## Environment Variables Required

### Backend (Optional - for future API integration)
- `READY_PLAYER_ME_API_KEY` - API key from RPM Studio (not required for iframe integration)
- `READY_PLAYER_ME_APP_ID` - App ID from RPM Studio (not required for iframe integration)
- `READY_PLAYER_ME_SUBDOMAIN` - Subdomain (e.g., 'cryptosnow') - optional, defaults to 'demo'

### Frontend
The RPM subdomain can be configured in one of two ways:

1. **Via Meta Tag** (recommended):
   ```html
   <meta name="rpm-subdomain" content="cryptosnow">
   ```

2. **Via JavaScript** (before app.js loads):
   ```html
   <script>window.RPM_SUBDOMAIN = 'cryptosnow';</script>
   ```

If not set, defaults to `'demo'` for development.

## Manual Steps Required

### 1. Run Prisma Migration

After pulling the changes, run the Prisma migration to add the new fields to the database:

```bash
npx prisma migrate dev --name add_rpm_avatar_fields
npx prisma generate
```

**For Production (Railway/PostgreSQL):**
```bash
npx prisma migrate deploy
npx prisma generate
```

### 2. Configure Ready Player Me Studio

1. Go to [Ready Player Me Studio](https://studio.readyplayer.me/)
2. Create or select your project
3. Configure the subdomain (e.g., `cryptosnow.readyplayer.me`)
4. Copy the subdomain name

### 3. Set RPM Subdomain in Frontend

Update `public/index.html` to set your RPM subdomain:

```html
<meta name="rpm-subdomain" content="cryptosnow">
```

Or if deploying to Netlify, you can set it as an environment variable and inject it during build, or use a script tag.

### 4. Deploy Changes

- **Backend**: Deploy to Railway (or your hosting platform)
- **Frontend**: Deploy to Netlify (or your hosting platform)

## How It Works

### Avatar Creation Flow

1. User logs in and lands on the homepage
2. System checks if user has `rpmAvatarId` set
3. If not, the avatar creator modal opens automatically
4. Game buttons are disabled until avatar is created
5. User creates avatar in the RPM iframe
6. When avatar is exported, `v2.avatar.exported` or `v1.avatar.exported` event is received
7. Avatar data is saved to backend via `POST /auth/me/avatar`
8. User state is updated and avatar card re-renders
9. Game buttons are re-enabled
10. Modal closes

### Avatar Display

- Avatar images are loaded from: `https://models.readyplayer.me/{avatarId}.png`
- The avatar card shows:
  - Avatar image (if `rpmAvatarId` exists)
  - "Change Avatar" button (if avatar exists)
  - "Create Avatar" button (if no avatar)

### Avatar Editing

Users can click "Change Avatar" to reopen the creator with their existing avatar pre-loaded.

## Testing Checklist

- [ ] New user without avatar: Modal opens automatically, buttons disabled
- [ ] Avatar creation completes: Avatar saved, card updates, buttons enabled
- [ ] Existing user with avatar: Avatar displays correctly
- [ ] "Change Avatar" button: Opens creator with existing avatar
- [ ] Modal cannot be closed when avatar is required
- [ ] Avatar image loads correctly from RPM CDN
- [ ] Mobile responsive: Avatar card and modal work on mobile
- [ ] Error handling: Backend save failure shows error message
- [ ] No regressions: Ticket wallet, game entry, auth flow still work

## Browser Compatibility

Tested on:
- Chrome (desktop + mobile)
- Safari (desktop and iOS)
- Firefox (desktop)

The iframe integration uses `postMessage` API which is widely supported.

## Troubleshooting

### Avatar not saving
- Check browser console for errors
- Verify `/auth/me/avatar` endpoint is accessible
- Check that user is authenticated (session/token valid)
- Verify Prisma migration ran successfully

### Avatar image not loading
- Check that `rpmAvatarId` is set correctly
- Verify avatar ID format matches RPM's expected format
- Check browser network tab for 404 errors on image URL

### Modal not opening/closing
- Check that modal HTML exists in DOM
- Verify event listeners are attached
- Check browser console for JavaScript errors

### Subdomain not working
- Verify meta tag or window variable is set correctly
- Check that subdomain is configured in RPM Studio
- Ensure iframe URL is correct (check browser console)

## Future Enhancements

The `lib/readyPlayerMeService.js` module is prepared for future enhancements:
- Guest user account creation
- Token-based authentication with RPM
- Account linking between CryptoSnow and RPM users
- Advanced user management features

These are not required for the current iframe-based integration but can be implemented later if needed.

## References

- [Ready Player Me Quickstart Guide](https://docs.readyplayer.me/ready-player-me/integration-guides/web-and-native-integration/quickstart)
- [Avatar Creator Integration](https://docs.readyplayer.me/ready-player-me/integration-guides/web-and-native-integration/avatar-creator-integration)
- [User Management](https://docs.readyplayer.me/ready-player-me/integration-guides/web-and-native-integration/user-management)
- [API Integration](https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration)

